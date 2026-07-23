# Aislamiento multi-tenant con Row-Level Security — plan de implementación

> Origen: `docs/architecture/audit-enterprise-2026.md` (hallazgo #1, "Aislamiento
> Multi-Tenant — Punto Más Frágil") propuso dos alternativas: Prisma Client
> Extensions + AsyncLocalStorage, o Row-Level Security (RLS) de Postgres, marcando
> RLS como "la opción de máxima seguridad". Este documento es el resultado de
> analizar ambas en profundidad con el usuario y decide **RLS**, con el diseño
> concreto de cómo evitar sus trampas conocidas.
>
> Este documento es la fuente de verdad de este trabajo. Si sos otra sesión de
> Claude retomando esto: leelo completo antes de tocar código, y actualizalo vos
> mismo a medida que avances (marcá la fase como hecha, agregá lo que encontraste,
> no lo dejes para "después").

## El problema

El aislamiento entre colegios (tenants) depende hoy de que cada desarrollador
escriba `where: { tenantId }` correctamente en cada query, en cada servicio. Es
disciplina humana, no una garantía del sistema. Una fuga de datos entre colegios
(un `findMany` sin filtrar, un query nuevo que se olvida del filtro) es
inaceptable para un producto que maneja datos de menores de edad y se vende a
colegios — y es del tipo de bug que no truena, se filtra en silencio.

## Por qué RLS y no solo Prisma Client Extensions

Una extensión de Prisma que reescribe `where` en JS depende de interceptar
correctamente cada forma de operación (`findMany`, `create`, relaciones
anidadas, `groupBy`, raw queries) — un caso no contemplado y el filtro se
salta sin que nada avise. RLS lo hace el motor de Postgres: **aunque el query
no tenga ningún `where`**, aunque sea un raw query, aunque la extensión de
Prisma tenga un bug, la base de datos igual rechaza filas de otro tenant. Es la
única capa que no se puede rodear escribiendo mal el código de la app.

Se usa una extensión de Prisma igual, pero como mecanismo para setear el
contexto (`SET LOCAL app.tenant_id`) de forma cómoda — RLS es la garantía real,
la extensión es sólo conveniencia de desarrollo.

## Trampas conocidas y cómo se evitan (esto es lo que hace que el plan sea completo)

Cada punto de acá se descubrió cuestionando la versión anterior del plan hasta
que dejó de tener huecos. Quedan documentados para que nadie los reintroduzca:

1. **El dueño de la tabla ignora RLS por default en Postgres.** El rol `classia`
   (con el que corren las migraciones) es dueño de las 32+ tablas. Sin
   `ALTER TABLE ... FORCE ROW LEVEL SECURITY` explícito, las políticas existen
   en el schema pero no hacen nada en la app real. **Toda tabla lleva `ENABLE` +
   `FORCE`, sin excepción.**

2. **21 tablas no tienen `tenantId` directo** — están protegidas hoy solo
   porque el código siempre las consulta a través de un padre ya filtrado
   (`electionId → Election.tenantId`, `sessionId → AttendanceSession.tenantId`,
   etc.). Entre ellas: `ElectionVote`, `ElectionVoter`, `ElectionCandidate`
   (la urna secreta), `ConversationMessage`, `ConversationMember` (mensajería
   privada), `TicketComment` (soporte). Un query directo a cualquiera de estas,
   sin pasar por el padre, hoy no tiene ningún filtro de tenant. **Se denormaliza
   `tenantId` en las 21 (Fase 1) antes de tocar RLS**, así todas las tablas
   siguen la misma política simple en vez de políticas por-join (más lentas y
   más fáciles de escribir mal, una por una).

3. **El wrapper no puede anidar transacciones.** `payments.service.ts`
   (registrar pago, con `FOR UPDATE`), `elections.service.ts` (`castVote`) y
   `report-cards.service.ts` (`generate`) ya abren su propia
   `prisma.$transaction(async (tx) => {...})`. El cliente `tx` no tiene método
   `.$transaction()` — no se puede abrir una transacción nueva desde adentro de
   una que ya está abierta. Por eso el mecanismo NO es "envolver cada operación
   suelta en su propia transacción" a ciegas: es un único wrapper sancionado
   (`runInTenantTransaction`) que es la única forma de abrir una transacción de
   negocio en todo el repo, y los tres servicios existentes se migran a usarlo.

4. **Raw queries no pasan por `$allOperations`.** El `FOR UPDATE` de
   `payments.service.ts` es un `tx.$queryRaw`. Se resuelve solo, gratis, en
   cuanto el punto 3 esté bien hecho: como corre dentro de la transacción que ya
   hizo `SET LOCAL`, hereda el contexto sin necesitar su propia lógica.

5. **SUPER_ADMIN/SUPPORT_AGENT necesitan lectura cross-tenant** (26 archivos
   dependen de esto: paneles, soporte, impersonación). No es un flag de sesión
   que cualquier código podría setear mal — es un **rol de Postgres aparte**
   (`classia_platform_admin`) con el atributo nativo `BYPASSRLS`, usado solo
   desde un método de servicio con nombre explícito, gateado por chequeo de rol
   en código. La mayoría de esos 26 casos en realidad no necesitan bypass: solo
   necesitan que se les setee `app.tenant_id` al tenant que el admin global
   *eligió* operar — el bypass real es para las pocas vistas genuinamente
   cross-tenant (listado de tenants, dashboards agregados).

6. **Nada de esto cierra bugs de "resolví el tenant equivocado" río arriba**
   (JWT/sesión). RLS defiende contra "me olvidé el filtro", no contra "filtré
   con el dato incorrecto". Por eso Fase 7 es un test de regresión real, no un
   checklist — para que este tipo de bug se detecte solo, siempre, en cada push.

## Decisiones tomadas con el usuario (2026-07-19)

1. **Sin piloto.** Se aplica a las ~49 tablas de una vez, no tabla-por-tabla.
   Justificación del usuario: estamos en desarrollo, no hay datos de clientes
   reales en riesgo todavía.
2. **RLS sobre Prisma Client Extensions + AsyncLocalStorage puro** — RLS es la
   garantía real (motor de base de datos); la extensión de Prisma queda como
   mecanismo de conveniencia para setear el contexto, no como la defensa en sí.
3. **Denormalizar `tenantId`** en las 21 tablas indirectas en vez de escribir
   políticas RLS con JOIN al padre — prioriza consistencia y auditabilidad
   (una sola forma de política, no 21 variantes) sobre evitar el cambio de
   schema.
4. **Bypass de admin global vía rol de Postgres nativo (`BYPASSRLS`)**, no vía
   variable de sesión custom — reduce la superficie de la única puerta trasera
   deliberada del sistema.
5. **Nada se declara "cerrado para siempre".** Cada fase termina con
   verificación real (typecheck + jest + en vivo), no con un checklist tildado.

## Fases

### Fase 0 — Este documento
Estado: ✅ hecho (2026-07-19). Rama: `feature/rls-aislamiento-multitenant`
(creada desde `main`, que ya incluye todo el trabajo de `feature/reportes-reales`
y la remediación de seguridad de `docs/planning/auditoria-seguridad-2026-07.md`).

### Fase 1 — Denormalizar `tenantId` en las tablas indirectas
Estado: ✅ hecho (2026-07-22).

Los 15 modelos que no tenían `tenantId` directo ya lo tienen, con `tenant
Tenant @relation(...)` y `@@index([tenantId])`: `StudentGuardian`,
`AttendanceRecord`, `GradingScaleBand`, `ReportCardLine`, `Question`,
`QuestionOption`, `QuizAnswer`, `HomeworkSubmission`, `ConversationMember`,
`ConversationMessage`, `AnnouncementRead`, `NotificationDelivery`,
`TicketComment`, `ElectionCandidate`, `ElectionVote`, `ElectionVoter`.

Migración: `packages/database/prisma/migrations/20260722100000_rls_denormalize_tenant_id/migration.sql`
— columna nullable → `UPDATE ... FROM <padre>` (en orden de dependencia:
`questions` antes que `question_options`, que backfillea desde `questions`,
no desde `homework` directamente) → `SET NOT NULL` → FK con `ON DELETE
RESTRICT` → índice. Aplicada a la BD de dev y confirmada: las 16 tablas
quedaron con `tenantId` `NOT NULL` sin filas huérfanas (cada `UPDATE`
reportó exactamente las filas esperadas, `SET NOT NULL` no falló en ninguna).

`NotificationPreference` sigue **pendiente de decisión de producto, no de
implementación** (ver razón original más abajo) — no se tocó.

**Efecto colateral esperado, ya resuelto**: el `tenantId` ahora requerido
rompió el build en cada `create`/`upsert`/`createMany` de estos 15 modelos
que antes no lo pasaba (`tsc` lo marcó solo, exactamente el tipo de bug que
este plan busca prevenir río abajo). Se corrigieron los 13 archivos de
servicio afectados (`announcements`, `attendance`, `conversations`,
`elections`, `grading`, `homework-submissions`, `notifications`,
`questions`, `quiz-attempts`, `report-cards`, `students`, `support`),
pasando siempre el `tenantId` ya resuelto en ese punto del código (del actor,
de la entidad padre ya cargada, o del `tenant` de la entidad propietaria) —
nunca un valor nuevo o adivinado. `npx tsc --noEmit` queda en verde en
`apps/api` y `apps/web` (el error inicial de `apps/web` era caché stale de
`.next/types` de rutas ya renombradas por otra sesión, no relacionado a este
cambio — confirmado limpiando `.next` y reconstruyendo).

### Fase 2 — RLS: `ENABLE` + `FORCE` en todas las tablas tenant-owned
Estado: ⏳ pendiente (depende de Fase 1).

### Fase 3 — Script de verificación exhaustivo
Estado: ⏳ pendiente. `scripts/verify-rls.ts`: lista blanca explícita de lo
genuinamente global, todo lo demás debe tener RLS forzado. Falla si encuentra
un modelo no clasificado — no busca "modelos con tenantId" (ese criterio fue
exactamente el que dejó pasar las 21 tablas de la Fase 1).

### Fase 4 — Extensión de Prisma + `runInTenantTransaction`
Estado: ⏳ pendiente.

### Fase 5 — Lint/CI contra `$transaction` crudo
Estado: ⏳ pendiente.

### Fase 6 — BullMQ: contexto de tenant por job
Estado: ⏳ pendiente. Afecta `documents.processor.ts`, `reports.processor.ts`,
`notifications.processor.ts`.

### Fase 7 — Test de regresión de aislamiento cross-tenant
Estado: ⏳ pendiente. Se agrega a la suite e2e existente
(`apps/api/test/backend-v1.e2e-spec.ts` o archivo nuevo) — la suite ya corre
contra Postgres/Redis reales, no hay que armar infraestructura de test nueva.

### Fase 8 — Verificación final
Estado: ⏳ pendiente. `tsc --noEmit` (api + web), jest completo, y verificación
en vivo: login normal, panel SUPER_ADMIN, un flujo de pagos, una votación, un
reporte generado — no alcanza con que la suite pase, tiene que verse funcionando.

## Fuera de alcance (a propósito)

El resto de `docs/architecture/audit-enterprise-2026.md` (TanStack Query en el
frontend, caché de Redis para lecturas, estrategia de testing con
Testcontainers, verificación de firma JWT en el middleware de Next.js) es real
pero es un problema distinto. No se mezcla acá para no diluir el foco de este
documento — si alguien lo retoma, que abra su propio plan.
