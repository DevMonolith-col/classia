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

3. **El wrapper no puede anidar transacciones — y eran 13 archivos (18
   sitios), no 3. Ya migrados (2026-07-22).** La versión original de este
   documento identificó `payments.service.ts`, `elections.service.ts` y
   `report-cards.service.ts` como los únicos casos. Un grep exhaustivo
   (`grep -rn "prisma\.\$transaction"`) encontró **13 archivos, 18 sitios**
   con `$transaction` crudo: los tres anteriores más `academic.service.ts`
   (2), `attendance.service.ts` (1), `conversations.service.ts` (2),
   `grading.service.ts` (3), `homework-submissions.service.ts` (1),
   `marks.service.ts` (1), `questions.service.ts` (1),
   `quiz-attempts.service.ts` (1), `settings.service.ts` (1),
   `support.service.ts` (1). Validado en vivo (tabla de prueba con RLS
   forzado + rol `classia_app`): una operación llamada *dentro* de un
   `$transaction` crudo (forma array o forma interactiva) corre en la
   conexión de ESA transacción, pero la extensión de Prisma solo puede
   setear `app.tenant_id` abriendo SU PROPIA mini-transacción nueva — que
   usaría una conexión DISTINTA del pool. El resultado no es una fuga de
   datos (RLS sigue fallando cerrado: cero filas), pero SÍ rompe la
   funcionalidad. El wrapper detecta "ya estoy dentro de una transacción
   sancionada" vía un flag explícito en el mismo contexto
   (`AsyncLocalStorage`) que carga el `tenantId` — **no** inspeccionando el
   cliente Prisma (`this` dentro de `$allOperations` no es el cliente, es
   un array interno de argumentos; confirmado con una prueba directa, otro
   supuesto que parecía razonable y no lo era).

   Los 18 sitios ya están migrados a `runInTenantTransaction` y verificados
   en vivo (creación de concepto de cobro + 100 facturas vía `createMany`
   dentro de la transacción, registro de un pago con el lock `FOR UPDATE`,
   guardado de periodos académicos con `deleteMany`+`createMany`) — sin
   errores, `tsc --noEmit` en verde. `settings.service.ts` es un caso
   especial: `SystemSetting` es global (sin `tenantId`, sin RLS), así que
   el wrapper ahí solo evita el problema de anidar `$transaction`, no
   scopea nada de verdad (usa el `tenantId` del contexto del actor —
   siempre `SUPER_ADMIN`, gateado en el controller — como valor de relleno
   inofensivo). `TenantRlsContextService` se registró como provider+export
   en el `PrismaModule` (que ya es `@Global()`) para que los ~13 módulos
   que ahora lo inyectan no necesiten importarlo uno por uno — sin esto,
   Nest tira `UnknownDependenciesException` al boot (encontrado y corregido
   en la misma verificación en vivo).

4. **Raw queries no pasan por `$allOperations`.** El `FOR UPDATE` de
   `payments.service.ts` es un `tx.$queryRaw`. Se resuelve solo, gratis, en
   cuanto el punto 3 esté bien hecho: como corre dentro de la transacción que ya
   hizo `SET LOCAL`, hereda el contexto sin necesitar su propia lógica.

5. **SUPER_ADMIN/SUPPORT_AGENT necesitan lectura cross-tenant** (paneles,
   soporte, impersonación, login/refresh de sesión). No es un flag de sesión
   que cualquier código podría setear mal — es un **rol de Postgres aparte**
   (`classia_platform_admin`) con el atributo nativo `BYPASSRLS`, usado solo
   desde un método de servicio con nombre explícito, gateado por chequeo de rol
   en código. Auditado y arreglado (2026-07-22, ver Fase 2 más abajo para el
   detalle completo): la mayoría de los casos reales no necesitaban bypass,
   solo que se les setee `app.tenant_id` al tenant ya conocido en ese punto
   del código (`runWithTenant`) — el bypass real quedó reservado para el
   puñado de casos genuinamente cross-tenant (bandeja de triage, roster de
   soporte, dashboard de salud, y — el hallazgo más importante de toda esta
   auditoría — el login/refresh/logout de sesión, que corre sin ningún JWT
   y por lo tanto sin ningún tenant conocido de antemano).

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
Estado: ✅ **SQL aplicado a la base de datos de dev (2026-07-23)**, sanity
checks estructurales en verde. Ver más abajo la sección "Aplicación a la
base de datos" y, sobre todo, el hallazgo crítico de la verificación en
vivo posterior (bug sistémico de `AsyncLocalStorage` + Prisma, encontrado y
arreglado el mismo día — es la entrada más importante de este documento).

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

3. **Auditoría de lecturas cross-tenant: hecha para las rutas que importan de
   verdad (2026-07-22).** El hallazgo original de este documento (trampa #5)
   anticipaba "26 archivos dependen de" lectura cross-tenant para
   SUPER_ADMIN/soporte. Metodología: dos búsquedas exhaustivas por agente
   (una para `findMany`/`count`/`aggregate`/`groupBy`/`findFirst`, otra para
   `findUnique`/`findUniqueOrThrow` — la primera pasada **no** cubría estas
   últimas, y ahí aparecieron 3 casos que la primera pasada se perdió; ojo
   con este punto ciego si alguien repite el ejercicio). Cada hallazgo se
   decidió caso a caso: ¿de verdad necesita ver TODOS los colegios (→
   `classia_platform_admin`), o solo necesita que se le setee `app.tenant_id`
   al colegio ya conocido en ese punto del código (→ `runWithTenant`, sin
   bypass)? Aplicar bypass de más reabriría exactamente el agujero que este
   proyecto existe para cerrar — por eso cada sitio usa lo mínimo necesario,
   nunca bypass "por si acaso".

   **Arreglado y verificado en vivo** (login, refresh, logout, triage de
   soporte, asignación de tickets, comentarios, cambio de estado,
   aprobar/negar/revocar/solicitar acceso, break-glass, dashboard
   SUPER_ADMIN, stats de salud — todo probado contra la app real, no solo
   `tsc`):
   - `apps/api/src/modules/support/support.service.ts` — `getAllTicketsForSuperAdmin`,
     `getTicketDetails`, `updateTicketStatus`, `addComment`, `assignTicket`,
     `getSupportAgents`.
   - `apps/api/src/modules/users/users.service.ts` — `findMyMemberships`
     (bypass seguro: filtrado por `userId` propio, no por tenant elegido por
     otro), `updateMembership`.
   - `apps/api/src/modules/health/health.service.ts` — `getStats`.
   - `apps/api/src/modules/access-control/access-control.service.ts` —
     `revokeAllForTicket`, `listForTicket`, `hasActiveScopeForTicket`,
     `requestAccess`, `breakGlass`, `revoke`, `getSolicitado` (usada por
     `approve`/`deny`).
   - `apps/api/src/modules/auth/auth.service.ts` — **el hallazgo más
     crítico de esta pasada**: `login()`, `refresh()`, `logout()`,
     `exitImpersonation()`, `impersonate()` y el `createSession()` privado
     compartido por los tres. `refresh()`/`logout()`/`exitImpersonation()`
     corren off la cookie de refresh token, **sin ningún JWT Bearer** — es
     decir, sin contexto de tenant ambiente del interceptor HTTP en
     absoluto. Sin este fix, **el login y el refresh de token de TODA la
     app se habrían roto** al aplicar el SQL de Fase 2, no solo un rincón
     de SUPER_ADMIN — el hallazgo de mayor impacto de toda esta auditoría.
     Verificado en vivo llamando `/auth/login`, `/auth/refresh` y
     `/auth/logout` directo (no solo por la UI) y confirmando en
     `auth_sessions` que cada sesión quedó revocada en el momento correcto.
   - `apps/api/src/core/prisma/platform-admin-prisma.service.ts` —
     hardening encontrado en el camino: si `DATABASE_URL_PLATFORM_ADMIN`
     apunta a un Postgres inalcanzable al boot, **tumbaba el arranque de
     toda la API** (no solo esta funcionalidad). Ahora degrada a "lanza
     recién cuando alguien use `.get()`", con el resto de la app funcionando
     normal.

   **Encontrado pero NO arreglado — pendiente, de menor prioridad**: un
   patrón sistémico repetido en ~16 archivos (`academic`, `attendance`,
   `events`, `grading`, `groups`, `guardians`, `homework`,
   `homework-submissions`, `marks`, `questions`, `quiz-attempts`,
   `report-cards`, `schedules`, `students`, `subjects`, `teachers` —
   service.ts en cada uno) — un `findUniqueOrThrow(where:{id})` sin
   `tenantId`, seguido de un helper `assertTenant`/`assertCanAccessTenant`
   que no-opea para `isGlobalAdmin(actor)` (SUPER_ADMIN/SUPPORT_AGENT).
   **Por qué se dejó para después, con evidencia, no solo por agotamiento**:
   se confirmó que `impersonate()` (ya arreglado arriba) emite el JWT de
   impersonación con `tenantId: targetTenant.id` — es decir, el flujo
   *real* soportado por el producto (SUPER_ADMIN entra a un colegio
   citando un ticket con acceso aprobado, y RECIÉN AHÍ opera sobre notas/
   asistencia/etc.) ya deja el contexto ambiente correctamente alineado con
   el tenant objetivo, porque `actor.tenantId` durante la impersonación ES
   el tenant objetivo. El hueco real es solo para un SUPER_ADMIN operando
   estos 16 módulos SIN impersonar primero — que bajo RLS fallaría cerrado
   (404/"no encontrado") en vez de silenciosamente funcionar cruzando
   tenants. Fallar cerrado es la dirección correcta del lado de la
   seguridad (no es una fuga), aunque rompa una funcionalidad que hoy
   "funciona" solo porque nada la protege. Si se decide cerrar esto de
   todas formas (por completitud, no por apuro), el patrón a aplicar es
   idéntico al ya usado 20+ veces en esta sesión: bypass para el
   `findUnique` inicial + `runWithTenant` para cualquier write subsecuente.

**Orden real de aplicación**: Fase 4 completa → Fase 6 completa → auditoría
de lecturas cross-tenant completa para las rutas críticas (login/refresh/
soporte/access-control) — **las tres hechas y verificadas en vivo**,
2026-07-22 → (opcional, menor prioridad: cerrar el patrón de los 16
archivos de arriba) → **recién ahí** aplicar el SQL de esta Fase 2 al
entorno de dev → verificación en vivo (login normal, panel SUPER_ADMIN,
soporte, un flujo de pagos, una votación, un reporte generado, el sweep de
accesos, un `impersonate()` real de punta a punta). Si algo falla en esa
verificación, el rollback es `DISABLE ROW LEVEL SECURITY` + `DROP POLICY`
tabla por tabla (no destructivo, no toca datos).

#### Aplicación a la base de datos (2026-07-23)

1. **Backup previo**: `pg_dump -F c` (formato custom) de la base completa
   ANTES de aplicar nada, vía `docker exec classia-postgres pg_dump ...`.
   Guardado en `docs/planning/backups/pre_rls_backup_20260723.dump` (726KB,
   gitignored — nunca sube a git). Nota operativa para quien repita esto en
   git-bash/MSYS en Windows: los paths tipo `/tmp/...` que van DENTRO del
   contenedor se mangléan a paths de Windows por la auto-conversión de
   MSYS; hay que prefijar el comando con `MSYS_NO_PATHCONV=1` para que
   llegue intacto al `docker exec`.
2. **Aplicado**: `docker exec -i classia-postgres psql -U classia -d
   classia_saas -f - < migration.sql` — 144 líneas de salida, cero
   `ERROR`. Confirmado idempotente (re-ejecutado sin efectos adicionales,
   los `DO $$ ... EXCEPTION WHEN duplicate_object$` y los `ALTER TABLE
   ... ENABLE/FORCE` no fallan en un segundo run). Marcado como aplicado en
   Prisma con `prisma migrate resolve --applied
   20260722110000_rls_enable_force_policies` (el SQL se corrió a mano, no
   con `prisma migrate deploy`, porque el usuario de esa conexión necesita
   ser el superuser `classia` para `CREATE POLICY`/`ALTER TABLE ... FORCE`,
   y `migrate deploy` en este repo usa `DATABASE_URL` que ya apunta a
   `classia`).
3. **Sanity checks estructurales** (vía `docker exec ... psql`, vale la pena
   repetir estos exactos cada vez que se re-aplique en otro entorno):
   - `pg_class.relrowsecurity`/`relforcerowsecurity` en `t`/`t` para tablas
     tenant-owned (`students`, `election_votes`, `ticket_comments`,
     `auth_sessions`, `audit_logs`, `tenant_memberships`) y en `f`/`f` para
     las 4 globales (`tenants`, `users`, `system_settings`,
     `notification_preferences`).
   - Separación de roles funcionando de verdad: `SELECT count(*) FROM
     students` como `classia_app` (sin contexto) → **0 filas**; la misma
     query como `classia` (superuser, ignora RLS) → 600 filas. Confirma que
     el rol de runtime no es accidentalmente un bypass.

#### Hallazgo crítico de la verificación en vivo: `AsyncLocalStorage` + Prisma lazy promises (2026-07-23)

**Este es el hallazgo de mayor severidad de todo el proyecto RLS — más que
la trampa #0 (superuser).** Con el SQL ya aplicado, el primer intento de
login real (`rector@demo.classia.com.co`, membership confirmada `ACTIVE`
en la base con una query directa) devolvió **`401 "Tenant membership is
not active."`** de forma 100% reproducible, para cualquier usuario, en
cualquier tenant.

**Causa raíz**: `TenantRlsContextService.runWithTenant(tenantId, callback)`
usaba `this.als.run({tenantId}, callback)` y devolvía eso tal cual. El
patrón de uso en `login()` (y en ~15 sitios más del código) era:

```ts
const membership = await this.tenantRlsContext.runWithTenant(tenant.id, () =>
  this.prisma.tenantMembership.findUnique({ where: {...} }),
);
```

Las queries de Prisma son **lazy** (`PrismaPromise`): `findUnique(...)`
devuelve un objeto thenable sin disparar ninguna ejecución todavía — recién
dispara la query real (y con ella, `$allOperations` de la extensión de RLS,
que lee `tenantRlsContext.getStore()`) cuando algo llama `.then()`/`await`
sobre ese objeto. En el patrón de arriba, ese `.then()` real ocurre en el
`await` que está FUERA de `runWithTenant(...)` — es decir, después de que
`als.run()` ya retornó y su ventana de contexto síncrona ya se cerró.
Node's `AsyncLocalStorage` solo propaga el contexto a continuaciones que
quedan enganchadas (via `.then()`/`await`) MIENTRAS el callback de `.run()`
todavía se está ejecutando; acá no queda enganchado nada, así que
`getStore()` devuelve `undefined` en el momento real de la query.
Resultado: la extensión nunca setea `app.tenant_id`, y RLS (correctamente)
devuelve cero filas — la membership existía y estaba `ACTIVE`, pero la
query la vio como si no existiera. **Falla cerrado, no es una fuga de
datos** — pero rompe login/refresh/logout/impersonate para el 100% de los
usuarios de la app, exactamente el escenario que motivó no aplicar el SQL
sin una pasada de verificación dedicada.

Confirmado con: (a) reproducción directa vía SQL manual (`BEGIN; SELECT
set_config(...); SELECT ... FROM tenant_memberships; COMMIT;` como
`classia_app`) — la fila aparece, ACTIVE, cuando el contexto se setea a
mano en la misma transacción; (b) instrumentación temporal
(`console.log` en `$allOperations`, revertida después) que mostró
`store: undefined` exactamente en la query de `TenantMembership.findUnique`
dentro de `login()`.

**Por qué el resto de la app SÍ funcionaba** (dashboard, estudiantes,
profesores, cursos — todos con datos reales tenant-scoped) **antes de este
fix**: esas rutas pasan por `TenantRlsContextInterceptor`, que envuelve
`next.handle().subscribe(subscriber)` DENTRO de `als.run()`. `.subscribe()`
dispara sincrónicamente toda la cadena de RxJS/promesas de Nest, incluido
el primer `.then()` real sobre la promesa del controller — ese `.then()`
SÍ queda enganchado dentro de la ventana de `als.run()`, así que el
contexto se propaga correctamente a través de todos los `await` internos
de ahí en adelante. El bug era específico de los **~15 sitios que llaman
`runWithTenant`/`withSessionTenant` a mano** (fuera de cualquier request
HTTP autenticado: `login`, `refresh`, `logout`, `exitImpersonation`,
`impersonate`, `createSession`, `users.service#updateMembership`, varios
en `access-control.service.ts`, `support.service.ts`,
`reports.service.ts`, y los processors de BullMQ) — exactamente las rutas
más críticas del sistema, y las que menos se ejercitan con tráfico
"normal" en un smoke test superficial.

**Fix, en la raíz** (`apps/api/src/core/prisma/tenant-rls-context.service.ts`):
`runWithTenant`/`runInTransaction` ahora son `async` y hacen `await
callback()` **adentro** de su propio callback pasado a `als.run()`:

```ts
async runWithTenant<T>(tenantId: string, callback: () => T | Promise<T>): Promise<T> {
  return this.als.run({ tenantId }, async () => {
    return await callback();
  });
}
```

Esto engancha el `.then()` real DENTRO de la ventana de `als.run()` sin
importar cómo haya escrito su callback quien llama (arrow plano
`() => prisma.x.y()` o `async () => { await ...; }` — ambos funcionan
ahora). Es la corrección correcta porque vive en el único punto compartido
por los ~15 sitios afectados, en vez de tener que auditar y reescribir
cada callsite individualmente (con el riesgo de que aparezca un sitio #16
nuevo mañana con el mismo problema).

**Segundo hallazgo, encontrado al re-probar login() después del fix
anterior**: `auth.service.ts` también llamaba `this.audit.record(...)`
(escribe en `audit_logs`, con RLS forzado) en 6 puntos de
`login`/`refresh`/`logout`/`impersonate`/`exitImpersonation` **sin envolver
la llamada en ningún contexto de tenant** — a diferencia de las queries de
Prisma de arriba, acá no había NINGÚN `runWithTenant`, ni siquiera el
patrón roto. Como `audit_logs` permite `tenantId IS NULL` pero estos
registros sí llevan un `tenantId` real, Postgres rechazaba el `INSERT` con
`new row violates row-level security policy for table "audit_logs"`
(42501) — un 500, no un 401 silencioso. Arreglado envolviendo los 6 sitios
en `withSessionTenant(...)`/`runWithTenant(...)` con el tenant ya conocido
en ese punto (igual que las queries de Prisma vecinas).

**Verificado en vivo, de punta a punta, después de ambos fixes**
(`npx tsc --noEmit` en verde en `apps/api` antes de cada prueba):
- Login (`rector@demo...`, `TENANT_ADMIN`) y login de `SUPER_ADMIN` — 201,
  tokens válidos, fila en `audit_logs` con el `tenantId` correcto, fila en
  `auth_sessions` correcta.
- `refresh()` con el token recién emitido — 201, sesión anterior revocada,
  nueva sesión creada, ambas con `tenantId` correcto.
- `logout()` — sesión revocada, auditoría correcta.
- Flujo de impersonación de punta a punta como `SUPER_ADMIN`: `POST
  /access-sessions/break-glass` sobre un ticket real del tenant demo →
  `POST /auth/impersonate` → token de impersonación funcional (probado
  contra `GET /students`, correctamente bloqueado por `DataScopeGuard` por
  falta de alcance `DATOS_PERSONALES` — comportamiento esperado, no un bug)
  → `POST /auth/refresh` de la sesión impersonada (revalida
  `hasActiveScopeForTicket`) → `POST /auth/exit-impersonation`. Los 4 pasos
  quedaron en `audit_logs` con el `tenantId` del colegio objetivo, no el
  del actor.
- `users.service#updateMembership` (mismo patrón de callback roto que
  login) — cambio de estado de una membership real (`ACTIVE` →
  `INACTIVE` → `ACTIVE`), confirmado en la respuesta y revertido.
- `PATCH /access-sessions/:id/revoke` — revocación real de la sesión de
  break-glass usada arriba.
- Navegación real por el frontend como `TENANT_ADMIN`: estudiantes (100),
  profesores (11), cursos (12), asistencia, calificaciones, pagos,
  reportes, certificados, soporte, elecciones (esta última había fallado
  con 401 antes del fix — confirmado que ahora carga) — todas con datos
  reales y coherentes entre sí. Panel `SUPER_ADMIN` con agregados
  cross-tenant reales (7 colegios, 240 usuarios) vía
  `PlatformAdminPrismaService`. Cero errores en los logs de la API en todo
  el recorrido.

**No verificado en vivo todavía** (el fix en la raíz cubre estos sitios
por construcción, pero no se disparó cada uno explícitamente): el job
`sweep` de `access-session-expiry.processor.ts`, `reports.processor.ts`
(`scheduled-run`), `support.service.ts` (`updateTicketStatus`/
`addComment`, sí probados en la pasada de auditoría anterior pero no
re-probados después de este fix específico). Riesgo residual considerado
bajo: todos siguen el mismo `runWithTenant` ya corregido en la raíz, y los
call-sites HTTP con el patrón idéntico (login, updateMembership,
break-glass) sí se re-probaron y funcionaron.

#### Segundo hallazgo crítico: `$queryRaw`/`$executeRaw` no pasan por la extensión de Prisma (2026-07-23)

Encontrado corriendo la suite `jest --config jest.config.cjs --runInBand`
completa (parte pendiente de la Fase 8) contra la BD con RLS ya forzado —
**no** por inspección de código, por un test que empezó a fallar de forma
100% determinista (3 corridas seguidas, mismo resultado): el conteo de
mensajes no leídos (`GET /conversations`) daba **0 para cualquier usuario**,
y una entrega de notificación por email no aparecía.

**Causa raíz**: `tenant-rls.extension.ts` declara `query: { $allModels:
{ $allOperations } }` — esto intercepta operaciones de MODELO
(`findMany`, `create`, `update`, etc.), pero `$queryRaw`/`$executeRaw` son
métodos de nivel de CLIENTE, no de modelo, así que la extensión nunca los
ve. `ConversationsService#unreadCountsFor` usaba `this.prisma.$queryRaw`
directo para un conteo agregado (`JOIN` + `GROUP BY`, no expresable
limpiamente con el query builder de Prisma) — esa query corría siempre sin
`app.tenant_id` seteado, y con RLS forzado en `conversation_messages`/
`conversation_members`, el resultado es cero filas siempre, sin importar
qué usuario o colegio. Es el mismo espíritu de la trampa #4 original
("raw queries no pasan por `$allOperations`"), pero ese punto asumía que
todo `$queryRaw` vivía dentro de una transacción ya abierta por
`runInTenantTransaction` (cierto para el único otro caso real,
`payments.service.ts` con `tx.$queryRaw` para el `FOR UPDATE`) — este caso
se coló porque corre standalone, fuera de cualquier transacción.

**Por qué agregar `WHERE tenantId = ...` al SQL crudo NO alcanza por sí
solo** (primer intento, todavía incompleto): RLS actúa sobre el *scan* de
la tabla en Postgres, antes de que el resultado del `WHERE` del caller
importe — si `current_setting('app.tenant_id')` no está seteado en esa
conexión, la política deja pasar cero filas de origen, sin importar cuántos
filtros adicionales tenga la query. El filtro explícito por `tenantId` es
buena defensa en profundidad (documenta intención, protege si algún día RLS
se desactivara por error), pero no sustituye setear la variable de sesión.

**Fix real**: igual que hace la extensión para operaciones de modelo,
envolver el `$queryRaw` en `this.prisma.$transaction([setConfig,
queryRaw])` (forma array — misma conexión) manualmente, ya que acá no hay
extensión que lo haga por nosotros:

```ts
const [, rows] = await this.prisma.$transaction([
  this.prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
  this.prisma.$queryRaw<...>(Prisma.sql`... WHERE m."tenantId" = ${tenantId} ...`),
]);
```

**Auditoría de todo el repo para este patrón** (`grep -rn
"\$queryRaw\|\$executeRaw" apps/api/src`): solo 3 sitios reales, ya
cubiertos —
`health.service.ts` (`SELECT 1`, sin datos de tenant, no aplica),
`payments.service.ts` (`tx.$queryRaw` dentro de `runInTenantTransaction`,
ya seguro), y este de `conversations.service.ts` (el único roto,
arreglado). **No quedan `$queryRaw`/`$executeRaw` standalone sin
contexto en el repo.**

**También se encontraron y arreglaron, en el camino de hacer pasar la
suite completa, dos gaps de la Fase 1 en el fixture de tests
(`apps/api/test/backend-v1.e2e-spec.ts`) — pre-existentes, no
introducidos por este trabajo, solo revelados al dejar de estar tapados
por el error de RLS**: `prisma.studentGuardian.upsert()` y
`prisma.attendanceSession.create()` (con `records: { create: [...] }`
anidado) no pasaban `tenantId` en el `create`, a pesar de que ambos
modelos lo requieren desde la denormalización de Fase 1
(2026-07-22). El propio fixture de test nunca se actualizó en ese
momento. Corregido pasando `tenantId: tenant.id` explícito en los 4
sitios. Además, el `beforeAll`/fixtures del archivo de test (que llaman a
`prisma.tenantMembership.upsert`, etc. fuera de cualquier request HTTP)
se envolvieron en `TenantRlsContextService#runWithTenant`, igual que el
código de la app — sin esto, la suite entera fallaba en el setup con
`new row violates row-level security policy` antes de correr un solo test.

**Suite completa verificada en verde después de ambos fixes**:
`npx jest --config jest.config.cjs --runInBand` → **24/24 tests pasan**,
3 corridas consecutivas. `npx tsc --noEmit` en verde en `apps/api`
(`test/` está excluido de ese `tsconfig.json`, por eso estos gaps no los
agarra el typecheck — son errores de runtime de Prisma, no de tipos).

### Fase 3 — Script de verificación exhaustivo
Estado: ⏳ pendiente. `scripts/verify-rls.ts`: lista blanca explícita de lo
genuinamente global, todo lo demás debe tener RLS forzado. Falla si encuentra
un modelo no clasificado — no busca "modelos con tenantId" (ese criterio fue
exactamente el que dejó pasar las 21 tablas de la Fase 1).

### Fase 4 — Extensión de Prisma + `runInTenantTransaction`
Estado: ✅ hecho y verificado en vivo (2026-07-22).

Entregables, todos hechos:
1. `apps/api/src/core/prisma/tenant-rls-context.service.ts` — el
   `AsyncLocalStorage` (`{tenantId, inTransaction}`). Registrado como
   provider+export en `PrismaModule` (ya `@Global()`) — sin esto Nest tira
   `UnknownDependenciesException` al boot (encontrado y corregido en la
   verificación en vivo).
2. `apps/api/src/common/interceptors/tenant-rls-context.interceptor.ts` —
   arranca el contexto por request HTTP desde `request.user.tenantId`.
   Registrado como `APP_INTERCEPTOR` global en `app.module.ts`, **primero**
   en la lista (los interceptors globales se anidan en orden de registro —
   tiene que ser el más externo para que envuelva también el write de
   auditoría de `ImpersonationAuditInterceptor`).
3. `apps/api/src/core/prisma/tenant-rls.extension.ts` — la extensión
   (`$allModels.$allOperations`). Si hay contexto activo y no está ya
   dentro de una transacción sancionada, corre `SET LOCAL app.tenant_id`
   (`SELECT set_config(...)` parametrizado) dentro de
   `client.$transaction([setConfig, query(args)])` en forma array — misma
   conexión, validado en vivo. Detecta "ya estoy en una transacción
   sancionada" vía el flag explícito del store de `AsyncLocalStorage` — NO
   inspeccionando el cliente Prisma (`this` dentro de `$allOperations` no
   es el cliente, es un array interno de argumentos, confirmado con prueba
   directa contra Prisma 5.22).
4. `apps/api/src/core/prisma/run-in-tenant-transaction.ts` — el wrapper.
   Los 18 sitios de la trampa #3 (13 archivos) ya lo usan en vez de
   `prisma.$transaction()` directo.
5. **`PlatformAdminPrismaService`** (`apps/api/src/core/prisma/platform-admin-prisma.service.ts`)
   — segundo `PrismaClient` real, conectado a `DATABASE_URL_PLATFORM_ADMIN`
   (rol `classia_platform_admin`, `BYPASSRLS`, login habilitado en
   `20260722130000_rls_platform_admin_login`). Expuesto vía un método
   `.get()` explícito, no como el cliente default inyectado — cada uso deja
   rastro en el código de quien lo llama. **Todavía no tiene ningún
   caller** — eso es la Fase 6 (job sweep) y la auditoría de los 26 puntos
   cross-tenant.
6. `PrismaModule` reescrito: `PrismaService` ahora se provee vía factory
   (no `useClass`) que crea un `PrismaClient` real conectado a
   `DATABASE_URL_APP` (rol `classia_app`, **nunca** `DATABASE_URL` =
   `classia`, superuser — trampa #0/#7) y le aplica la extensión. El
   `PrismaClient` base vive en una variable a nivel de módulo (no dentro de
   la clase `PrismaService`) porque `$extends()` no conserva métodos custom
   de una subclase (`onModuleInit`/`onModuleDestroy`) — el connect/disconnect
   ahora lo maneja `PrismaModule` mismo. `PrismaService` sigue siendo el
   token de inyección en los ~43 archivos que lo usan, sin tocar ninguno
   (patrón oficial de Prisma para extensiones + NestJS).
7. Variables de entorno nuevas: `DATABASE_URL_APP`, `DATABASE_URL_PLATFORM_ADMIN`
   (`.env`, `.env.example`, `env.schema.ts`, `database.config.ts`).

**Verificado en vivo de punta a punta** (API + web reales, con el
mecanismo completo conectado — cada Prisma call de la app ahora pasa por
la extensión): login normal y SUPER_ADMIN, dashboard con stats reales,
calificaciones, creación de elección con candidato anidado, concepto de
cobro con 100 facturas via `createMany` dentro de una transacción, pago
con lock `FOR UPDATE`, guardado de periodos académicos
(`deleteMany`+`createMany`), listado de conversaciones, dashboard
SUPER_ADMIN con agregados cross-tenant (funciona hoy porque RLS todavía no
está forzado — se rompería sin el bypass una vez se aplique la Fase 2,
exactamente el trabajo pendiente de la auditoría de los 26 puntos). Cero
errores en los logs de la API en todo el recorrido. `tsc --noEmit` en
verde.

### Fase 5 — Lint/CI contra `$transaction` crudo
Estado: ⏳ pendiente. Nota (2026-07-22): la migración de los 18 sitios
existentes que usaban `$transaction` crudo a `runInTenantTransaction` ya NO
era parte de esta fase — se movió a ser prerrequisito de la Fase 2 (ver
trampa #3, **ya hecho**), porque sin ella la Fase 2 rompe funcionalidad
real, no es opcional/futuro. Lo que queda en esta Fase 5 es la regla de
lint/CI en sí
(ESLint custom rule o `grep` en CI) que impida que código NUEVO reintroduzca
`prisma.$transaction` crudo — puramente preventivo hacia adelante.

### Fase 6 — BullMQ: contexto de tenant por job
Estado: ✅ hecho y verificado en vivo (2026-07-22).

Los 4 processors afectados, todos con `tenantId` viajando en `job.data`
desde que se encola (el código que encola siempre lo tiene a mano:
`actor.tenantId` o el de la entidad recién creada), y `process()` envuelve
el resto del job en `tenantRlsContext.runWithTenant(job.data.tenantId,
...)` ANTES de la primera query:

- `reports.processor.ts` — jobs `generate` y `scheduled-run`. También
  `reconcileSchedulers()` (llamado al boot, `ReportsModule.onModuleInit`):
  **hallazgo nuevo** — corre sin contexto de request y necesita ver los
  schedules activos de TODOS los colegios, así que ahora usa
  `PlatformAdminPrismaService` para esa lectura inicial. Y
  `scheduleNextRun()` (compartido entre un request HTTP y el boot) ahora
  establece su propio contexto explícitamente para su `update`, sin asumir
  el del caller.
- `documents.processor.ts` — job `generate`.
- `notifications.processor.ts` — job `dispatch`.
- `access-session-expiry.processor.ts` — el job `expire-one` sigue el mismo
  patrón (tenantId conocido al programarlo en `scheduleExpiryJob`). El job
  `sweep` es legítimamente cross-tenant: `expireOverdueSessions()` usa
  `PlatformAdminPrismaService` **solo** para descubrir las candidatas de
  todos los colegios (`select id, tenantId`), y el trabajo real de cada una
  (`expireSessionById` — transición, revocar `AuthSession`, auditar) corre
  scopeado al tenant de ESA sesión particular vía
  `tenantRlsContext.runWithTenant`, no con bypass — el bypass solo abre la
  puerta a encontrarlas, no se usa de más.

**Verificado en vivo** (job real de BullMQ ejecutándose, no solo tsc):
generación de un reporte (PDF vía Puppeteer, `generate`), emisión de un
certificado (`documents.processor.ts`), y publicación de un comunicado →
`notify()` → job `dispatch` de `notifications.processor.ts` (confirmado en
la tabla `notification_deliveries`: status `SKIPPED` con
`error: "email provider 'disabled'"`, exactamente el comportamiento
esperado en este entorno sin `EMAIL_PROVIDER` configurado — la fila se
creó y el job la procesó correctamente end-to-end). Cero errores en los
logs de la API. El boot de la API con `reconcileSchedulers()` usando el
cliente de bypass también se probó en vivo sin errores.
`expire-one`/`sweep` no se probaron en vivo (difícil de disparar sin
esperar un vencimiento real o mockear tiempo) pero siguen exactamente el
mismo patrón ya validado en los otros tres processors, y `tsc --noEmit`
está en verde.

### Fase 7 — Test de regresión de aislamiento cross-tenant
Estado: ⏳ pendiente. Se agrega a la suite e2e existente
(`apps/api/test/backend-v1.e2e-spec.ts` o archivo nuevo) — la suite ya corre
contra Postgres/Redis reales, no hay que armar infraestructura de test nueva.

### Fase 8 — Verificación final
Estado: ✅ hecho (2026-07-23). `tsc --noEmit` en verde en `apps/api`;
`jest --config jest.config.cjs --runInBand` (suite e2e completa contra
Postgres/Redis reales, con RLS genuinamente forzado) en **24/24 verde**,
3 corridas consecutivas deterministas; y la verificación en vivo manual
completa descrita arriba: login/refresh/logout, impersonación de punta a
punta (break-glass → impersonate → refresh → exit), panel SUPER_ADMIN,
soporte, estudiantes/profesores/cursos/asistencia/calificaciones/pagos/
reportes/certificados/elecciones, `updateMembership`. Dos bugs reales de
RLS encontrados y arreglados en esta pasada (no simulados, ambos
reproducidos y confirmados contra la app real): el bug de
`AsyncLocalStorage`+Prisma-lazy-promises en `runWithTenant` (Fase 2) y el
gap de `$queryRaw` sin contexto en `unreadCountsFor` (arriba). Pendiente,
de menor prioridad y sin evidencia de que sea un problema real: re-probar
explícitamente en vivo (no solo por construcción del fix) el job `sweep`
de expiración de accesos y `reports.processor.ts#scheduled-run` — ambos
usan `runWithTenant` ya corregido, y la suite jest ejercita
`reports.processor.ts` (job `generate`) sin problemas.

## Fuera de alcance (a propósito)

El resto de `docs/architecture/audit-enterprise-2026.md` (TanStack Query en el
frontend, caché de Redis para lecturas, estrategia de testing con
Testcontainers, verificación de firma JWT en el middleware de Next.js) es real
pero es un problema distinto. No se mezcla acá para no diluir el foco de este
documento — si alguien lo retoma, que abra su propio plan.
