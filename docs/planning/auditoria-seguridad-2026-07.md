# Auditoría de seguridad y correctitud — plan de remediación (2026-07-18)

> Origen: code review multiagente de toda la rama `feature/reportes-reales` vs `main`
> (dominios: reportes/pagos, elecciones/documentos, calificaciones, mensajería/
> notificaciones, soporte/auth/RBAC). Los 🔴/🟠 de seguridad se verificaron a mano
> contra el código. Este documento es la fuente de verdad del trabajo de remediación.

## Decisiones tomadas con el usuario (2026-07-18)

1. **Impersonación** → sesión efímera **en memoria**: no persistir ninguna
   `TenantMembership`; derivar el rol TENANT_ADMIN solo dentro del token/sesión de
   impersonación + endpoint de salida que revoca la `AuthSession` en el servidor.
2. **Primera tanda** → solo seguridad **crítica + alta** (Fase 1). El resto en tandas
   siguientes.
3. **`categoryId`** → arreglar **ahora** (aunque no haya UI de categorías todavía).
4. **Track visual** → **aparte**, después del backend, con verificación en navegador.

---

## FASE 1 — Seguridad crítica + alta ✅ HECHO (2026-07-18)

Estado: implementada y verificada. Typecheck limpio (api + web). E2e 11/12 (el 1 que
falla es **preexistente** e independiente: la entrega EMAIL de notificaciones no sale
de PENDING porque el worker BullMQ no procesa en el contexto de test — la suite llevaba
sin poder arrancar desde que se agregó puppeteer, así que quedó oculto). Flujo de
impersonación verificado end-to-end contra la API real: impersonar no crea membership,
`bootstrap` sintetiza la membership, `refresh` preserva `isImpersonated`, y
`exit-impersonation` revoca la sesión (refresh posterior → 401).

Extra hecho: stub de puppeteer en Jest (`apps/api/test/mocks/puppeteer.stub.ts` +
`jest.config.cjs`) para que la suite e2e vuelva a arrancar; migración
`20260720130000_add_auth_session_impersonation` (campos de AuthSession + drop de
`election_votes.createdAt`).



### WS2 · IDOR cross-tenant en soporte 🔴
- **`apps/api/src/modules/support/support.service.ts:161` (`addComment`)** — no valida
  tenant/acceso al ticket. Cargar el ticket y exigir `isSupportStaff || ticket.tenantId
  === user.tenantId` antes de crear el comentario (mismo check que `getTicketDetails`).
- Verificación: e2e nuevo (usuario de tenant A → 403/404 al comentar ticket de tenant B).

### WS1 · Cluster de impersonación 🔴🟠
- **`auth.service.ts:203` (`impersonate`)** 🔴 — dejar de crear/reactivar `TenantMembership`.
  Emitir un token de impersonación que lleve el rol efectivo (TENANT_ADMIN) y un flag
  `isImpersonated`; el rol se resuelve de la sesión, no de una fila persistida.
- **Endpoint de salida** 🔴 — `POST /auth/exit-impersonation` que revoca la `AuthSession`
  de impersonación en el servidor (hoy `lib/auth.ts:200` solo limpia el cliente).
- **`auth.service.ts:139` (`refresh`)** 🟠 — propagar `isImpersonated` (y rol efectivo)
  a `createSession`, para que el interceptor de auditoría no deje de registrar tras 15 min.
- **`impersonation-audit.interceptor.ts:31`** 🟠 — redactar campos sensibles
  (`password`, `passwordHash`, `token`, `refreshToken`, `secret`) antes de guardar `body`.
- Verificación: e2e de impersonar → salir → confirmar que no queda membership ni sesión
  viva, y que el token de refresh sigue marcado como impersonación.

### WS3 · Seguridad alta aislada 🟠
- **`notifications.processor.ts:52` (email)** — escapar entidades HTML de `title`, `body`
  y `firstName` antes de construir el `html` (helper `escapeHtml`).
- **`pdf-renderer.service.ts:21` (SSRF)** — `page.setRequestInterception(true)` y abortar
  toda request cuyo `url()` no empiece por `data:` (permitir solo assets embebidos).
- **`elections.service.ts:296` (secreto del voto)** — no persistir `createdAt` en
  `election_votes` (o insertar en lote barajado / truncar a fecha), para que no se pueda
  correlacionar por timestamp con `election_voters.votedAt`.
- Verificación: unit/e2e de escape de email; test de que una plantilla con `<img>/<iframe>`
  externo no dispara request saliente; revisión de que el JOIN por timestamp ya no aísla.

### Extra · `categoryId` (correctitud, se arregla ahora por decisión) 🟠 latente
- **`marks.service.ts`** — persistir `categoryId` en `upsertMark`/`create`/`bulkCreate`
  (añadir a `MarkWriteInput` y a los writers) para que el motor ponderado encuentre notas
  cuando se habiliten categorías. Hoy corre el fallback de promedio simple, así que no hay
  regresión visible; esto lo deja correcto para el futuro.

---

## FASE 2 — Integridad de datos (backend) ✅ HECHO (2026-07-18)

Estado: implementada y verificada. Typecheck limpio (api + web); e2e 11/12 (mismo fallo
preexistente del worker EMAIL, sin regresiones). Verificado en vivo contra la API:
sobrepago rechazado (400) y transiciones PARTIAL→PAID correctas; resumen financiero por
agregación en BD (invoiced/collected/pending exactos, rate 100%, sin pending negativo);
`generate-bulk` como admin global sin `tenantId` → 403. Migración
`20260720140000_report_card_uniqueness` (unique de periodo + índice parcial para el anual).



- **Pagos** — `recordPayment` en `$transaction` + rechazar `amount > saldo`
  (`payments.service.ts:128`); `getFinancialSummary` con `groupBy`/`aggregate` en BD en vez
  de cargar todo en memoria (`:198`); `createFeeConcept` en `$transaction` (`:41`).
- **`generateBulk`** — exigir `tenantId` explícito para admin global; hoy sin scoping puede
  tocar todos los tenants (`report-cards.service.ts:257`).
- **Filtros `isActive`** — añadir `student.isActive: true` en la resolución de destinatarios
  de broadcast (`conversations.service.ts:410`) y de comunicados
  (`notifications.listeners.ts:147`).
- **Boletín** — bloquear regeneración también en `PUBLISHED` (o versionar) y agregar
  `@@unique([studentId, academicYearId, periodId])` (`report-cards.service.ts:186`).
- **`unreadCount`** — calcular con `count()`, no sobre los 50 mensajes cargados
  (`conversations.service.ts:536`).
- **`resolveVotingStudent`** — filtrar `isActive: true` (`elections.service.ts:410`).

## FASE 3 — Rendimiento (backend) ✅ HECHO (2026-07-18)

Estado: implementada y verificada. Typecheck limpio; e2e 12/12 (ejercita el notify en
lote y el broadcast).

- **Motor de boletines** (`report-cards.service.ts`): `subjectPeriodFraction` pasó de una
  query por (materia × periodo × categoría) a cálculo EN MEMORIA sobre 2 queries por alumno
  (todas las marks del año + todas las categorías del grupo). Elimina el N+1 severo; el
  reporte de notas (`reports.service.ts`, que llama `compute()` por alumno) hereda la
  mejora. Residual menor: `compute()` aún re-lee scale/año/materias por alumno (optimización
  futura, no crítica).
- **`notify()` en lote** (`notifications.service.ts`): preferencias EMAIL en un `findMany`,
  notificaciones y entregas por `createMany` (con UUID generados en app), y encolado por
  `queue.addBulk`. Antes: 1 query + 1 create + 1 enqueue por usuario en serie. Todo
  envuelto en try/catch para no romper la acción de dominio. Se eliminó `isChannelEnabled`
  (código muerto tras el refactor).
- **`listBroadcastTargets`** (`conversations.service.ts`): un solo `findMany` de
  `studentGuardian` agrupado en memoria, en vez de una query por grupo (N+1).
- **✅ RESUELTO — entrega EMAIL de notificaciones (era contaminación de datos del test, NO
  un bug de prod)**. Diagnóstico: el paso 3 del test e2e deshabilita la preferencia
  `ANNOUNCEMENT_PUBLISHED/EMAIL` del acudiente y nunca la resetea; como la BD e2e es
  compartida y no se limpia, desde la segunda corrida ya no se creaba la entrega EMAIL →
  el test veía `undefined`. Se verificó que el worker de producción está sano: en la API
  real, tras publicar un comunicado, la entrega pasó a `SKIPPED` en ~576ms
  (`EMAIL_PROVIDER=disabled`). Fixes en el test: (1) resetear la preferencia al inicio
  (idempotente entre corridas), (2) invocar el `NotificationsProcessor` directamente en vez
  de esperar al worker (determinista, sin depender del timing de la cola en el harness).
  Suite ahora 12/12, estable en corridas repetidas.

## FASE 4 — Scheduler de reportes (backend) ✅ HECHO (2026-07-18)

Estado: implementada y verificada. Decisión del usuario: **reprogramación dinámica**
(soporta cualquier intervalo 1–12, no solo divisores de 12). Typecheck limpio; 18/18 jest
(6 unit de recurrencia + 12 e2e). Verificado en vivo: schedule MONTHLY cada 5 meses creado
en julio → `nextRunAt = 2026-12-15 07:00 Bogotá` (12:00 UTC), job diferido encolado en
Redis con jobId por-ocurrencia; al borrarlo, el job se elimina.

- Se reemplazó el scheduler repetible de BullMQ (cron `*/N` en el campo mes, que significaba
  "meses divisibles por N desde enero" y corría en UTC) por **jobs diferidos one-off
  reprogramados dinámicamente**. La próxima corrida se calcula con date-math anclado a
  `createdAt` y a la zona horaria del colegio (`Tenant.timezone`, default America/Bogota),
  a las 07:00 locales, en `reports.recurrence.ts` (con test unitario).
- El processor reprograma la siguiente ocurrencia al inicio del job, anclada a la ocurrencia
  actual (`scheduledFor`) → determinista ante reintentos y un fallo puntual no rompe la
  recurrencia. Nuevo campo `ReportSchedule.nextRunAt` (migración
  `20260720150000_add_report_schedule_next_run`). `reconcile` al boot limpia el scheduler
  repetible viejo y recalcula el próximo job diferido.

## FASE 5 — Bajos / limpieza ✅ HECHO (2026-07-18)

Estado: implementada y verificada. Typecheck limpio (api + web); 18/18 jest. Decisiones del
usuario: comunicados → **soft-delete**; rate-limit → **instalar @nestjs/throttler con Redis**.
Verificado en vivo: `verify/:code` corta en el 11º request (429); borrar un comunicado lo
saca de la lista pero conserva la fila con `deletedAt`.

- **Resend 4xx permanente**: `EmailResult.permanent` marca 4xx (salvo 429) como fallo no
  reintentable; el processor no relanza en ese caso (no quema los 5 intentos). Transitorios
  (5xx/429/red) sí reintentan.
- **Conversaciones archivadas**: `sendMessage` rechaza escribir en un hilo con `archivedAt`.
- **Soft-delete de comunicados**: nuevo `Announcement.deletedAt` (migración
  `20260720160000`); `delete()` marca `deletedAt`; las lecturas filtran `deletedAt: null`.
- **Rate-limit**: `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` (almacén Redis
  compartido), sin guard global; aplicado a `GET /documents/verify/:code` (10 req/min por IP).
  Queda listo para `/auth/login`.
- **Roles plataforma unificados**: `PLATFORM_ROLES` como fuente única en `users.service`
  (SUPER_ADMIN + SUPPORT_SUPERVISOR + SUPPORT_AGENT), usado en `isGlobalAdmin` y
  `assertCanAssignRole`. Corrige que el supervisor no fuera global-admin de scoping (lo es
  ≤ su poder de impersonación) y elimina la fragilidad.
- **`getResults`** (elecciones) gatea por `ELECTIONS_MANAGE`, no por roles fijos.
- **Limpieza**: se quitó el `return true` inalcanzable en `jwt-auth.guard`; el middleware web
  alinea el acceso a `/admin` con el backend (solo SUPER_ADMIN + SUPPORT_SUPERVISOR).

## FASE 6 — Alineación del cálculo de notas ✅ HECHO (2026-07-18)

Estado: implementada y verificada. Al analizarla resultó NO ser un ajuste visual sino una
decisión de modelo de calificación. Había tres criterios distintos: preview del frontend
(ponderado por peso de tarea), boletín oficial hoy (promedio simple, por el fallback sin
categorías), y el modelo por categorías (diseñado, sin UI). Decisión del usuario: **peso
por tarea** es el autoritativo.

- El motor backend (`report-cards.subjectPeriodFraction`) ahora, en el camino sin categorías
  (el activo hoy), pondera por `homework.weight` (peso 1 si la nota es manual), el MISMO
  criterio que `lib/grading.ts` del frontend → el preview coincide con el boletín oficial.
  Se precarga `homework.weight` en la query de notas.
- Se corrigió el comentario engañoso en `lib/grading.ts` (antes afirmaba que compartían
  criterio cuando no era cierto).
- Verificado en vivo: escenario con 2 tareas (peso 30/70) y notas 5/5 y 3/5 → preview del
  boletín = **3.6** (ponderado), no 4.0 (promedio simple). Typecheck limpio; 18/18 jest.
- Las categorías ponderadas del backend quedan como feature futura (necesitan UI para
  configurarse + cablear el preview); cuando se construyan habrá que re-alinear.

> Nota: no hubo cambios de UI nuevos que "ver" en navegador — la alineación es que el
> preview existente ahora coincide con el boletín. La UI derivada mencionada antes
> (badge de campanita con `unread-count`, toggle `mutedAt`) NO se abordó aquí; queda como
> mejora de producto pendiente (ver estado-del-proyecto.md).

---

## RESUMEN FINAL ✅ Auditoría completa (2026-07-18 → 2026-07-19)

Las 6 fases del plan están hechas, verificadas (typecheck + jest + verificación en vivo
contra la API real y/o el navegador para cada una) y comiteadas en `feature/reportes-reales`
en 30 commits atómicos (Conventional Commits, sin auto-atribución). Resumen por fase:

| Fase | Qué | Verificación |
|---|---|---|
| 1 | IDOR de soporte, impersonación efímera, XSS email, SSRF PDF, secreto del voto, `categoryId` | e2e 11/12 (1 preexistente) + flujo de impersonación en vivo |
| 2 | Pagos transaccionales, `generateBulk` con tenant, unique de boletín, filtros `isActive` | e2e 11/12 + sobrepago/resumen en vivo |
| 3 | N+1 de boletines, `notify()` en lote, `listBroadcastTargets` | e2e 12/12 |
| 4 | Scheduler de reportes: reprogramación dinámica, zona horaria | 6 unit + e2e 12/12 + schedule real en Redis |
| 5 | Resend 4xx, soft-delete comunicados, rate-limit, roles plataforma | 18/18 jest + rate-limit/soft-delete en vivo |
| 6 | Alineación notas frontend/backend (peso por tarea) | 18/18 jest + preview en vivo (3.6 vs 4.0) |

**Verificación adicional del propósito de la rama (2026-07-19)**: más allá de la auditoría
de seguridad, se confirmó en navegador real que el módulo `reports` (razón de ser de
`feature/reportes-reales`) está funcionalmente completo: los 6 tipos de reporte devuelven
datos reales, la generación PDF/CSV asíncrona funciona (Puppeteer real, no el stub de
tests), la descarga por URL firmada funciona, el historial y los contadores se actualizan
correctamente, y el ciclo completo de programación recurrente (crear → verificar en
Redis/BD → eliminar) funciona de punta a punta. Ver `estado-del-proyecto.md` (corrección
2026-07-19) para el detalle actualizado de qué está conectado. **No queda pendiente nada
del alcance original de reportes** — lo que sí queda pendiente son mejoras de producto
fuera de ese alcance (transcript multi-año, estadísticas agregadas, UI de categorías
ponderadas), ya documentadas en otros archivos de `docs/planning/`.

### Cambios de infraestructura que quien haga pull debe saber
- **Dependencias nuevas**: `@nestjs/throttler`, `@nest-lab/throttler-storage-redis`,
  `ioredis` (Fase 5) → correr `pnpm install`.
- **Migraciones nuevas** (Fases 1, 2, 4, 5): impersonación/voto (`20260720130000`), unique
  de boletín (`20260720140000`), `nextRunAt` de reportes (`20260720150000`), soft-delete de
  comunicados (`20260720160000`) → correr `prisma migrate deploy`.
- **`docker compose up -d`** debe estar arriba (Postgres/Redis/MinIO) antes de correr
  migraciones o levantar la API.

---

## Notas de ejecución

- E2e comparten la BD de dev y acumulan datos → usar `toBeGreaterThanOrEqual`/IDs
  específicos, no conteos exactos.
- `prisma generate` con la API en `--watch` activo falla con EPERM → detener la API antes
  de migrar.
- Cambios de schema en esta remediación: `@@unique` de boletín (Fase 2), drop de
  `election_votes.createdAt` (Fase 1, ya hecho) → migraciones idempotentes.

## ⚠️ Deuda de infraestructura de tests (detectada en Fase 1)

- **La suite e2e llevaba sin poder arrancar**: `puppeteer` (>=23) es ESM-only y Jest no lo
  transforma; como `AppModule` importa `PdfRendererService`, TODA la suite reventaba al
  parsear `import puppeteer`. Se destrabó con un stub solo-para-tests
  (`apps/api/test/mocks/puppeteer.stub.ts` + mapeo en `jest.config.cjs`). Consecuencia
  grave: mientras estuvo rota, cualquier regresión cubierta por e2e pasó desapercibida
  (así se coló el fallo del worker de EMAIL — ver Fase 3). Revisar si conviene una solución
  definitiva (transformar puppeteer, o no cargar el módulo PDF en test).
- Un `pnpm install` al inicio de la sesión dejó `puppeteer` en una versión ESM-only; el
  stub de Jest lo compensa para tests, pero conviene fijar/revisar la versión.
