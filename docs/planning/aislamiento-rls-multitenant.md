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

0. **(La más severa, encontrada recién al validar Fase 4 en vivo, 2026-07-22.)
   El rol "classia" es SUPERUSER de Postgres.** Es el usuario de bootstrap
   de la imagen oficial de `postgres` (`POSTGRES_USER` en
   `docker-compose.yml`), y un superuser **siempre** ignora Row-Level
   Security — ni `FORCE ROW LEVEL SECURITY` lo cambia (FORCE solo quita la
   excepción de "dueño de tabla", no la de superuser). Sin esto, **todo el
   plan sería un no-op silencioso**: las políticas existirían en el schema,
   `tsc` compilaría, todo se vería correcto, y ninguna fila quedaría
   protegida — el peor tipo de falla posible para un control de seguridad
   (parece que funciona, no funciona). Confirmado con una prueba directa
   contra Postgres (tabla de prueba con FORCE RLS: como "classia" devolvió
   todas las filas de todos los tenants sin importar el contexto; como el
   nuevo rol "classia_app", sin privilegios de superuser, devolvió cero
   filas sin contexto y solo las correctas con `SET LOCAL`). **Se soluciona
   con dos roles separados**: "classia" (superuser, dueño de las tablas)
   sigue corriendo `prisma migrate` — las migraciones necesitan esos
   privilegios para `ALTER TABLE`/`CREATE POLICY`. La APP en runtime se
   conecta con un rol nuevo, "classia_app" (`NOSUPERUSER NOBYPASSRLS`,
   migración `20260722120000_rls_app_roles`, ya aplicada) vía una variable
   de entorno nueva, `DATABASE_URL_APP` — nunca con `DATABASE_URL`. Esto es
   universal, no un detalle de este repo: cualquier despliegue que use el
   usuario de bootstrap de Postgres como conexión de la app tiene este
   mismo problema.

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
Estado: ⏳ SQL escrito y committeado, **NO aplicado a la base de datos
todavía** — a propósito.

Migración: `packages/database/prisma/migrations/20260722110000_rls_enable_force_policies/migration.sql`.
Clasificación completa (auditoría exhaustiva de los 52 modelos del schema,
no una búsqueda de "modelos con tenantId" — ese criterio es exactamente el
que dejó pasar el hueco de la Fase 1):
- **46 tablas** con política estándar (`tenantId` `NOT NULL`).
- **2 tablas** (`auth_sessions`, `audit_logs`) con política que además deja
  pasar `tenantId IS NULL` — nullable por diseño, para sesiones/acciones de
  plataforma sin colegio asociado (confirmado: son las únicas 2 con
  `tenantId String?` en todo el schema).
- **4 tablas genuinamente globales, sin RLS** (allow-list): `tenants`,
  `users` (un usuario pertenece a varios colegios vía `TenantMembership`),
  `notification_preferences` (pendiente de decisión de producto, Fase 1),
  `system_settings`.
- Rol `classia_platform_admin` con `BYPASSRLS` creado (sin `LOGIN` — la
  contraseña real, fuera de git, es trabajo de Fase 4).

**Por qué no está aplicado todavía, y qué destrabó esto (hallazgo nuevo,
2026-07-22):** `FORCE ROW LEVEL SECURITY` sin que nada setee
`app.tenant_id` bloquea el 100% de las queries — la app completa deja de
funcionar. Al diseñar cómo evitar eso (Fase 4, contexto vía
AsyncLocalStorage por request HTTP) aparecieron dos casos que Fase 4 sola
NO cubre:

1. **Los 4 procesadores de BullMQ corren fuera de cualquier request HTTP**
   (`reports.processor.ts`, `documents.processor.ts`,
   `notifications.processor.ts`, `access-session-expiry.processor.ts`) —
   no hay `request.user` del que leer `tenantId`. Sus primeras queries son
   lookups por solo-ID (`findUnique({where:{id}})`, sin `tenantId` en el
   `where`, porque hoy confían en que el ID vino de una fuente legítima) —
   bajo RLS forzado, esas queries devolverían 0 filas y el job fallaría en
   silencio. **Fix decidido**: el `tenantId` viaja en el `job.data` desde el
   momento en que se encola (el código que encola siempre lo tiene a mano:
   `actor.tenantId` o el `tenantId` de la entidad recién creada) — así el
   contexto se establece ANTES de la primera query del job, sin necesitar
   resolver nada. Esto es Fase 6, y por lo anterior, **Fase 2 depende de
   Fase 6 tanto como de Fase 4**, no solo de Fase 4 como decía la versión
   anterior de este documento.

2. **El job "sweep" de `access-session-expiry.processor.ts` es
   legítimamente cross-tenant a propósito** (barre `AccessSession`
   vencidas de TODOS los colegios como red de seguridad periódica) — no
   tiene un solo tenant que ponerle en el `job.data`. Este es un caso real
   de necesitar el rol `classia_platform_admin` (`BYPASSRLS`), no un
   contexto de tenant.

3. **Función abierta, todavía sin auditar**: el hallazgo original de este
   documento (trampa #5) ya anticipaba "26 archivos dependen de" lectura
   cross-tenant para SUPER_ADMIN/soporte (bandeja de triage entre colegios,
   dashboards agregados, listado de tenants). Cada uno de esos 26 puntos
   necesita decidirse caso a caso: ¿de verdad necesita ver TODOS los
   colegios (→ `classia_platform_admin`), o solo necesita que se le setee
   `app.tenant_id` al colegio que el admin *eligió* operar (→ contexto
   normal, sin bypass)? Aplicar bypass de más reabriría exactamente el
   agujero que este proyecto existe para cerrar. Esta auditoría todavía no
   se hizo — es la condición de cierre real de Fase 4/6 antes de poder
   aplicar el SQL de Fase 2 sin romper funcionalidad existente de soporte.

**Orden real de aplicación**: Fase 4 (mecanismo HTTP + extensión + wrapper
+ cliente `classia_platform_admin` real) → Fase 6 (tenantId en job.data +
el job sweep usando el cliente bypass) → auditoría de los 26 puntos
cross-tenant de SUPER_ADMIN/soporte → **recién ahí** aplicar el SQL de esta
Fase 2 al entorno de dev → verificación en vivo (login normal, panel
SUPER_ADMIN, soporte, un flujo de pagos, una votación, un reporte
generado, el sweep de accesos). Si algo falla en esa verificación, el
rollback es `DISABLE ROW LEVEL SECURITY` + `DROP POLICY` tabla por tabla
(no destructivo, no toca datos).

### Fase 3 — Script de verificación exhaustivo
Estado: ⏳ pendiente. `scripts/verify-rls.ts`: lista blanca explícita de lo
genuinamente global, todo lo demás debe tener RLS forzado. Falla si encuentra
un modelo no clasificado — no busca "modelos con tenantId" (ese criterio fue
exactamente el que dejó pasar las 21 tablas de la Fase 1).

### Fase 4 — Extensión de Prisma + `runInTenantTransaction`
Estado: ⏳ pendiente.

Entregables concretos:
1. `TenantContextService` — wrapper delgado sobre `AsyncLocalStorage<{tenantId}>`.
2. Interceptor global (no middleware — el middleware corre antes que los
   guards, y `request.user` recién existe después de `JwtAuthGuard`) que
   arranca el contexto desde `request.user.tenantId` para el resto del
   request.
3. Prisma Client Extension (`$allModels.$allOperations`) que, si hay
   contexto activo, corre `SET LOCAL app.tenant_id` antes de cada
   operación. Detecta si ya está corriendo dentro de una transacción
   abierta por `runInTenantTransaction` (`typeof this.$transaction ===
   "function"` distingue el cliente top-level del `tx` — el `tx` no tiene
   ese método, que es justo la trampa #3) para no intentar anidar una
   transacción nueva.
4. `runInTenantTransaction(tenantId, callback)` — el único punto sancionado
   para abrir una transacción de negocio; migra `payments.service.ts`,
   `elections.service.ts` y `report-cards.service.ts` a usarlo en vez de
   `prisma.$transaction()` directo.
5. **Cliente `classia_platform_admin` real** (segundo `PrismaClient`,
   credenciales por variable de entorno, rol `BYPASSRLS` creado en Fase 2) —
   no estaba en el alcance original de esta fase, pero el hallazgo del sweep
   job de accesos (Fase 6) y los 26 puntos de lectura cross-tenant de
   SUPER_ADMIN/soporte (trampa #5) lo necesitan de verdad, no como algo
   especulativo. Se expone detrás de un método de servicio con nombre
   explícito (p. ej. `PlatformAdminPrismaService`), nunca como el cliente
   default inyectado.

### Fase 5 — Lint/CI contra `$transaction` crudo
Estado: ⏳ pendiente.

### Fase 6 — BullMQ: contexto de tenant por job
Estado: ⏳ pendiente. Ver el hallazgo en Fase 2 más arriba para el porqué.

Afecta 4 processors: `reports.processor.ts` (jobs `generate` y
`scheduled-run`), `documents.processor.ts`, `notifications.processor.ts`,
`access-session-expiry.processor.ts`.

Para los primeros tres: agregar `tenantId` al `job.data` en cada punto
donde se encola (`queue.add`/`addBulk`/`upsertJobScheduler` — el código que
encola siempre tiene `actor.tenantId` o el `tenantId` de la entidad recién
creada a mano), y al entrar al processor, envolver el resto de la lógica del
job en el contexto de tenant (`tenantContext.run({tenantId: job.data.tenantId}, ...)`)
ANTES de la primera query — incluyendo el `findUnique({where:{id}})` inicial
que hoy no filtra por tenant.

Para `access-session-expiry.processor.ts`: el job `expire-one` sigue el
mismo patrón (tenantId conocido al programarlo). El job `sweep` es
legítimamente cross-tenant — usa el cliente `classia_platform_admin`
(`BYPASSRLS`) de Fase 4, no contexto de un tenant.

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
