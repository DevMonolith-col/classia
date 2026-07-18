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

## FASE 3 — Rendimiento (backend)

- N+1 en reporte de notas y generación masiva de boletines: precargar marks del grupo/año
  en pocas queries y calcular en memoria (`reports.service.ts:339`,
  `report-cards.service.ts:248`).
- `notify()` en lote: un `findMany` de preferencias + `createMany`, no 1 query por usuario
  (`notifications.service.ts:38`).
- `listBroadcastTargets`: un solo `groupBy` en vez de una query por grupo
  (`conversations.service.ts:132`).
- **⚠️ Pendiente detectado en Fase 1 — entrega EMAIL de notificaciones**: el test e2e
  "creates in-app notifications from events…" falla porque el `NotificationDelivery` de
  canal EMAIL se queda en `PENDING` (nunca pasa a `SKIPPED`). El worker BullMQ
  (`NotificationsProcessor`) no procesa el job en el contexto de test. Falta determinar si
  es solo infra de test (el worker no arranca dentro de `Test.createTestingModule`) o un
  bug real de despacho en runtime. Estaba oculto porque la suite e2e no arrancaba (ver
  Notas de ejecución). Investigar aquí.

## FASE 4 — Scheduler de reportes (backend)

- Recurrencia mensual `intervalValue > 1`: `*/N` en el campo mes del cron es incorrecto;
  calcular el próximo run con date-math anclado a `createdAt`/`lastRunAt`
  (`reports.service.ts:223`).
- Zona horaria del colegio en las opciones del scheduler (hoy corre en UTC).
- Revisar re-registro de schedulers DAYS en cada arranque (`reconcileSchedulers`).

## FASE 5 — Bajos / limpieza

- Resend: tratar 4xx (salvo 429) como fallo permanente sin reintentar 5 veces.
- Rechazar mensajes a conversaciones archivadas (`sendMessage`).
- Decidir soft-delete vs hard-delete de comunicados (retención Ley 1620/527).
- Rate-limit en `GET /documents/verify/:code` (endpoint público con PII).
- Alinear middleware `SUPPORT_AGENT`/`/admin` con el backend; quitar código muerto en
  `jwt-auth.guard.ts`.
- Unificar el set de roles "plataforma" (`isGlobalAdmin` incluye `SUPPORT_AGENT` pero no
  `SUPPORT_SUPERVISOR`).
- `getResults` (elecciones) gatear por permiso `ELECTIONS_MANAGE`, no por rol fijo.

## FASE 6 — Track visual (sesión aparte)

- **`lib/grading.ts:16`** — alinear el motor del frontend (hoy pondera por nota individual)
  al modelo de categorías del backend (agrupar por categoría → promediar → ponderar), para
  que la vista previa coincida con el boletín oficial. Requiere levantar la app y verificar
  en navegador que preview == boletín.
- Cualquier UI derivada de las notas (badge de campanita con `unread-count`, toggle de
  silenciado `mutedAt`) se trata en este track.

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
