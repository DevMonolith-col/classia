# Estado del Proyecto — Classia SaaS

> Última actualización: 2026-07-26, rama `main`.
> Este documento reemplaza a `roadmap-prototype-2.md` como fuente de verdad del estado actual — ese archivo quedó desactualizado (fue escrito antes de construir materias, horarios, asistencia, calificaciones, tareas, etc., que hoy ya existen). Se movió a `archive/` el 2026-07-19 junto con otros planning docs igualmente superados; no se debe seguir usando para saber qué falta.
>
> **Corrección del 2026-07-16**: la versión anterior de este documento (2026-07-13) quedó obsoleta en cuestión de horas — el commit `5e93a6a` del mismo día, y después toda la mensajería (`4e3517c`..`f6bc554`), invalidaron varias de sus afirmaciones. Decía que `Message`/`Announcement`/`HomeworkSubmission` eran modelos fantasma, que no existía la calificación manual de respuesta corta, que `GUARDIAN` no tenía scoping ni permisos, y que `/familia/*` estaba mock sin excepción: **todas eran falsas**. Se corrigieron abajo. Lección para el próximo que edite este archivo: fecharlo y verificar contra el código, no contra la memoria.
>
> **Corrección del 2026-07-19** (rama `feature/reportes-reales`): este documento (§3, línea 96 en su momento) decía que `/admin/reportes` estaba "sin backend ni conexión". **Ya no es cierto**: entre el 2026-07-18 y el 2026-07-19 se construyó el módulo `reports` completo (6 tipos de reporte con queries reales, generación async PDF/CSV vía BullMQ, historial, programación recurrente con reprogramación dinámica) y el módulo `payments` (conceptos de cobro, facturas, pagos, resumen financiero). Ambos verificados end-to-end en navegador real (preview → generar → descargar → programar → eliminar) el 2026-07-19. Además, esa misma rama pasó por una auditoría de seguridad de 6 fases sobre TODO el diff acumulado (no solo reportes) — ver `auditoria-seguridad-2026-07.md` para el detalle completo (hallazgos, decisiones tomadas y verificación de cada fase).

> **Corrección del 2026-07-25** (limpieza de contexto para agentes): §2 omitía diez módulos del backend que ya existían, y §6 seguía diciendo que `pnpm lint` estaba roto cuando se arregló en `e27e4b9`. Ambos corregidos abajo. Se agregaron dos pendientes que estaban solo implícitos en el código (§6.8 app móvil, §6.9 estado de cuenta para familias). En §5, la afirmación de que `Mark` no tenía unique constraint **era obsoleta** (ya lo tiene, junto con `upsertMark()` como writer único) — y al verificarla apareció un **bug confirmado**: los dos writers sin migrar no setean `academicYearId`, así que una nota calificada puede quedar invisible y sin contar para el boletín. Está documentado como ítem propio en §5. En la misma pasada se archivaron los cinco briefs de `docs/agents/` — eran de mayo, habían derivado hasta ser falsos, y su contenido transversal vive ahora en `CLAUDE.md`; ver `archive/README.md` para el detalle de por qué cada uno quedó superado.

> **Corrección del 2026-07-26** (cierre del calendario y del chat en tiempo real): §2 decía que el chat **no tenía tiempo real** y §5 lo repetía como deuda; §3 listaba `mensajes/nuevo` como página muerta en admin y profesor cuando ya se habían borrado el 2026-07-18 en `83c50b4`; §4 daba por muertos `ConversationMember.mutedAt` y `GET /notifications/unread-count`, que hoy se usan; y §5 decía que quedaban 3 diferencias entre el schema y la base, que ya son cero. Todas corregidas abajo. La de `mensajes/nuevo` vale la pena señalarla aparte: **estaba desactualizada hace ocho días y se propagó** — `chat-tiempo-real.md` la copió de acá como pendiente, y así una tarea ya hecha sobrevivió en dos planes.

Este documento se generó auditando el código real (rutas, llamadas a la API, modelos de Prisma, módulos del backend), no de memoria. Cada afirmación de "funciona" o "es mock" se verificó revisando si la página hace `apiFetch` real o solo tiene arrays hardcodeados.

---

## 1. Stack y estructura

```
classia-saas/
├── apps/
│   ├── web/     # Next.js 16 (App Router, Turbopack), Tailwind, shadcn/ui
│   └── api/     # NestJS + Prisma + Zod
├── packages/
│   ├── database/    # Prisma schema, migraciones, seed
│   ├── shared/
│   └── validators/
├── docker-compose.yml  # postgres, redis, minio (S3-compatible, storage local)
```

No existe `apps/mobile` — la app móvil (React Native/Expo) mencionada en documentos de diseño anteriores nunca se inicializó.

**Multi-tenant:** por `x-tenant-slug` header en dev, por hostname en producción. RBAC vía permisos por rol (`apps/api/src/common/permissions/permissions.ts`).

**Roles existentes:** `SUPER_ADMIN`, `SUPPORT_AGENT`, `TENANT_ADMIN`, `PRINCIPAL`, `COORDINATOR`, `SECRETARY`, `TEACHER`, `GUARDIAN`, `STUDENT`.

**Credenciales demo:** ver tabla en `README.md` (tenant `demo`, password `ClassiaDemo2026!` para todos).

---

## 2. Lo que funciona de verdad (backend real + UI conectada)

### Autenticación y plataforma
- Login/logout/refresh con JWT + refresh tokens rotativos, sesiones revocables.
- `/app/bootstrap`: perfil del usuario, tenant, membresía, permisos, resumen por rol (admin/profesor/guardian/estudiante).
- Middleware de Next.js protege rutas por rol y redirige a la sección correcta.
- Auditoría (`AuditService`) registra automáticamente creaciones/ediciones sensibles con old/new values.
- Storage S3-compatible (MinIO en dev) para adjuntos e imágenes, con URLs firmadas.

### SuperAdmin (`/superadmin`)
- Dashboard, gestión de tenants (crear/editar/suspender), usuarios globales, log de auditoría con paginación y diff-view. Todo conectado a datos reales.

### Panel del colegio (`/admin`)
- **Asignaciones** (`/admin/asignaciones`): vista de solo lectura de todas las tareas/exámenes/quices/proyectos de todos los profesores, con filtro por profesor y por tipo. Datos 100% reales.
- **Asistencia** (`/admin/asistencia`): vista de auditoría real.
- **Calificaciones** (`/admin/calificaciones`): tabla real con edición inline de notas.
- **Horarios** (`/admin/horarios`) y **Materias** (`/admin/materias`): CRUD real.

### Panel del profesor (`/profesor`)
- **Mis Clases** (`/profesor/clases`): resumen de materias/grupos asignados, agrupados, con navegación con contexto (`?scheduleId=`) hacia Asignaciones/Calificaciones/Asistencia.
- **Asignaciones** (`/profesor/asignaciones`): CRUD completo de tareas/exámenes/quices/proyectos. Editor de página completa (no modal) con: peso ponderado, fecha y hora de entrega, adjunto de archivo, modo de navegación libre/secuencial (para quices/exámenes), banco de preguntas (opción múltiple / verdadero-falso / respuesta corta) con retroalimentación por opción e imagen por pregunta, soporte de fórmulas LaTeX (KaTeX) en enunciados/opciones/descripciones.
- **Calificaciones** (`/profesor/calificaciones`): tabla tipo hoja de cálculo, una columna por tarea, ponderada automáticamente, con "Nota final" calculada.
- **Asistencia** (`/profesor/asistencia`): toma de asistencia real por sesión, con historial.

### Portal del estudiante (`/alumno`)
- Login propio (antes los estudiantes no podían iniciar sesión — se agregó `Student.userId`).
- Lista de asignaciones con estado y tipo.
- **Motor de quices real**: iniciar intento, responder pregunta por pregunta (respeta modo libre/secuencial del profesor), autoguardado, envío, autocalificación de preguntas de opción múltiple/verdadero-falso, resultado con retroalimentación por opción e imágenes.
- Al enviar un quiz, se crea/actualiza automáticamente una `Mark` que alimenta la tabla de calificaciones del profesor — el circuito está cerrado de punta a punta.
- Vista de calificaciones propias.

### Backend — módulos reales (`apps/api/src/modules/`)

> Lista corregida el 2026-07-25 con `ls apps/api/src/modules/`: la versión anterior omitía diez módulos que ya existían (`academic`, `access-control`, `documents`, `elections`, `grading`, `payments`, `report-cards`, `reports`, `settings`, `support`).

`academic`, `access-control`, `announcements`, `attendance`, `audit`, `auth`, `bootstrap`, `conversations`, `documents`, `elections`, `events`, `files`, `grading`, `groups`, `guardians`, `health`, `homework`, `homework-submissions`, `marks`, `notifications`, `payments`, `questions`, `quiz-attempts`, `report-cards`, `reports`, `schedules`, `settings`, `students`, `subjects`, `support`, `teachers`, `tenants`, `users`.

`elections` no está documentado en ninguna parte y maneja **urna secreta** (`ElectionVote`, `ElectionVoter`, `ElectionCandidate`): el secreto del voto es una garantía de privacidad propia, distinta del aislamiento por tenant. Merece su propia auditoría antes de que alguien construya encima — hoy nadie sabe si un join o un log revela quién votó qué.

### Mensajería, comunicados y notificaciones — construido entre el 2026-07-13 y el 14
- **Chat 1:1 real** (`conversations`): reemplazó el modelo `Message` por `Conversation`/`ConversationMember`/`ConversationMessage`. Scoping "el acudiente solo escribe a los profesores de sus hijos" derivado de `Schedule`. Soft-delete que conserva la fila (retención obligatoria por Ley 1620 y Ley 527).
- **Tiempo real completo — terminado el 2026-07-26** (actualizado ese día; antes esta línea decía "no tiene tiempo real"). Las siete fases de `chat-tiempo-real.md`: gateway socket.io con adaptador de Redis y salas `user:{id}`, entrega en vivo sin recargar la bandeja, badge de no leídos, historial paginado por cursor, `"escribiendo..."` con la pertenencia validada en el servidor, presencia con Set de Redis + heartbeat de 90 s, checks de leído reales, adjuntos, y silenciar hilos. 31 tests e2e con un cliente socket.io real, cada afirmación verificada por reversión.
  - **Los handlers de socket corren fuera del request**, así que no tienen contexto de tenant: sin `runWithTenant` las consultas devuelven cero filas en silencio. Es la misma trampa de RLS que apareció en el feed ICS y en los procesadores de BullMQ (`aislamiento-rls-multitenant.md`).
- **Difusión a grupo**: patrón "mass message" — el profesor difunde a un grupo y se abre un hilo DIRECT privado por familia; las familias no se ven entre sí.
- **Comunicados / cartelera** (`announcements`): con visibilidad por rol y grupo.
- **Notificaciones in-app + email** (`notifications`): arquitectura event-driven con `@nestjs/event-emitter`; estrena la primera cola BullMQ real del repo. `EmailService` degradable (`EMAIL_PROVIDER=disabled` → entrega `SKIPPED`; `=resend` → API REST de Resend).
- **Scoping de `GUARDIAN`**: `permissions.ts` le da lectura de homework/marks/attendance, y los 3 services tienen `resolveOwnChildIds` (vía `guardian.students` → `StudentGuardian.studentId`).

### Entregas de tareas y calificación (`5e93a6a`)
- **`homework-submissions`**: el alumno sube archivo para Tarea/Proyecto (ventanas `availableFrom`/`cutOffDate`, marcado `LATE` automático) y el profesor califica con nota + comentario + archivo de devolución, en una transacción que crea/actualiza la `Mark`.
- **Calificación manual de respuesta corta**: `PATCH /homework/:id/quiz/attempts/:attemptId/questions/:questionId/grade` + UI en `/profesor/quiz/[homeworkId]/calificar`. Al calificar la última respuesta corta el intento pasa a `GRADED` y nace la `Mark` sola.

### Reportes y pagos — construido el 2026-07-18/19 (rama `feature/reportes-reales`)
- **Reportes** (`/admin/reportes`, módulo `reports`): 6 tipos reales con queries en vivo (asistencia, calificaciones — reusa el motor de `report-cards`, estudiantes, profesores, cursos, financiero). Preview síncrono (JSON) + generación asíncrona vía BullMQ (PDF con `PdfRendererService`/Puppeteer compartido, o CSV), historial con contador de descargas, descarga por URL firmada. **Programación recurrente**: jobs diferidos reprogramados dinámicamente (no cron estático), anclados a `Tenant.timezone`, correctos para cualquier intervalo mensual 1–12 (ver `auditoria-seguridad-2026-07.md` Fase 4). CRUD completo de schedules (crear/listar/pausar/editar/eliminar) desde la UI.
- **Pagos** (`/admin/pagos`, módulo `payments`): conceptos de cobro (facturación masiva por colegio o por grupo), facturas con estado PENDING/PARTIAL/PAID/CANCELLED, registro de pagos transaccional con guardia de sobrepago, resumen financiero por agregación en BD. Dinero en `Decimal`, no `Float`.
- Ambos verificados end-to-end en navegador real (no solo backend): golden path completo de reportes probado el 2026-07-19 — preview con datos reales, generación de PDF real, descarga, historial, creación y eliminación de un schedule (con verificación del job en Redis).

---

## 3. Lo que es mock / no funcional todavía

Las páginas marcadas como mock existen visualmente (con buen diseño) pero **no hacen ninguna llamada a la API** — son arrays hardcodeados.

> Corregido el 2026-07-16: la versión anterior decía que `/familia/*` estaba mock "completo, sin excepción" y que `mensajes` no tenía backend en ninguno de los 3 portales. Ya no es cierto — abajo la lista real.

### Portal de familia/acudientes (`/familia/*`) — parcial
- **Conectadas**: `calificaciones`, `mensajes`, `comunicados`, `notificaciones`.
- **Todavía mock**: `page.tsx` (dashboard — incluido su array `notifications` hardcodeado), `tareas` (`mockTasks`), `asistencia`, `horario`, `incapacidades`, `ajustes`.
- `familia/tareas` está bloqueada además por permisos: `GUARDIAN` no tiene ningún `HOMEWORK_SUBMISSIONS_*`, así que no puede ver la entrega ni la retroalimentación de su hijo. Ver `asignaciones-calificacion-en-linea.md` §5.

### Panel del colegio (`/admin`) — pendientes

> Corregido el 2026-07-26: esta lista decía que el dashboard tenía "stats hardcodeadas" y
> que `calendario` no tenía backend. Ninguna de las dos era cierta ya — abajo lo verificado
> contra el código.

- `page.tsx` (Dashboard): **conectado**. `useDashboardStats` calcula estudiantes, profesores,
  grupos y asistencia del día con cuatro llamadas reales (`/students`, `/teachers`, `/groups`,
  `/attendance/sessions?from&to`), y `useUpcomingEvents` trae los próximos eventos de
  `/events?limit=4`. Lo que sigue pendiente es el fan-out de 4 requests y que la asistencia se
  agrega en el cliente.
- `calendario`: **conectado** el 2026-07-26 (Fases 1 y 2 de `calendario.md`). Backend real
  (modelo `Event` completo, rango `from`/`to`, `PATCH`, audiencia por rol y grupo,
  soft-delete, 18 tests e2e) y página real: crea, edita y borra contra la API, con la grilla
  extraída a `components/shared/calendar/` para que la reusen los portales de familia,
  profesor y alumno. Incluye el **feed ICS suscribible** (Fase 5): `GET /calendar/feed/:token.ics`
  sin sesión, con token por usuario revocable, y el botón "Suscribir a mi calendario" con QR.
  Incluye también la **agregación multi-fuente** (Fase 3): `GET /calendar?from&to&sources=` junta
  eventos, entregas, periodos, cartera, elecciones y clases en una sola respuesta, aplicando los
  permisos de cada módulo por separado. **El módulo está completo** (fases 1 a 5): incluye los
  portales de `/familia/calendario`, `/profesor/calendario` y `/alumno/calendario`, y los
  recordatorios configurables por evento vía BullMQ. Lo único fuera de alcance es la sync
  bidireccional con Google/Microsoft, que es plugin de pago (`plugins.md` §2 Módulo C).
- `configuracion`, `plugins`, `plugins/desarrolladores`: sin backend ni conexión.
- (`reportes` y `pagos` ya se conectaron el 2026-07-18/19 — ver §2.)
- (`estudiantes`, `profesores`, `cursos` ya se conectaron en `1f9870b`.)

### Panel del profesor (`/profesor`) — pendientes
- `horario`, `configuracion`: sin conectar.
- `page.tsx` (Mi Panel): ya conectado, pero calcula los pendientes por calificar con un **fan-out N+1** (`GET /homework` y luego un `GET /homework/:id/submissions` por cada tarea).

### Otros
- `/registro`: formulario de planes estático, no crea un tenant real (el endpoint `POST /tenants` existe pero requiere permiso de administrador — no hay alta autoservicio).
- `/recuperar-password`: sin flujo real de recuperación.

---

## 4. Campos y enums declarados en el schema sin uso real

> Corregido el 2026-07-16. La versión anterior listaba aquí `Message`, `Announcement` y `HomeworkSubmission` como "modelos fantasma". **Los tres se implementaron**: `Message` ya ni existe (lo reemplazó `Conversation`/`ConversationMember`/`ConversationMessage` en `5c3bde0`), `Announcement` se extendió y tiene módulo propio (`cbaf1fd`), y `HomeworkSubmission` tiene módulo backend completo + UI de entrega del alumno + UI de calificación del profesor (`5e93a6a`).

Lo que sí sigue declarado y muerto, verificado por grep:

- **`ConversationType.GROUP`** (`schema.prisma:433`) — declarado, no implementado. La difusión a grupo usa fan-out a hilos DIRECT privados, por decisión de producto ("respuestas privadas al profesor").
- **`Conversation.groupId` / `subjectId` / `title`** — nunca se escriben; `getOrCreateDirectConversationId` solo setea `tenantId`/`type`/`createdById`/`members`.
- ~~**`ConversationMember.mutedAt`**~~ — **vivo desde el 2026-07-26** (Fase 7): `POST /conversations/:id/mute` lo escribe y `NotificationsListeners` lo respeta. Silenciar apaga el aviso, no la entrega.
- ~~**`ConversationMessage.attachmentKey` / `attachmentName`**~~ — **vivos desde el 2026-07-26** (Fase 6). Existían desde el principio y ninguna pantalla los escribía; no estaban listados acá porque el schema los declaraba junto a los de soporte, que sí se usaban.
- **`HomeworkSubmission.status = "PENDING"`** (`:412`) — es el default del schema pero es **inalcanzable**: ningún camino crea una submission sin `status` explícito. La UI tiene label y color para él y nunca se renderiza.
- **`NotificationChannel.IN_APP`** (`:544`) — declarado, pero las notificaciones in-app se crean como fila `Notification` directa; solo EMAIL genera `NotificationDelivery`. Patrón asimétrico a tener en cuenta si se agrega un canal PUSH/WS.
- ~~**`GET /notifications/unread-count`**~~ — **lo llama `use-unread-count.ts` desde el 2026-07-26**. La campanita tiene badge en móvil (`UnreadBell`) y en el nav de escritorio (`NavUnreadBadge`), y el socket avisa cuando cambia en vez de encuestar.

## 5. Deuda técnica / decisiones tomadas conscientemente que valen la pena revisar

- **`/admin/asignaciones` es de solo lectura** por decisión de consistencia con `/admin/asistencia` y `/admin/calificaciones` (patrón "el profesor gestiona, el admin audita"). Si se necesita que un admin pueda editar/eliminar una asignación de cualquier profesor, hay que decidir esa UX explícitamente. Ojo: `permissions.ts` **ya da** `HOMEWORK_SUBMISSIONS_GRADE` a los 4 roles de admin — hay permiso de backend sin UI.
- ~~**`Mark` no tiene `@@unique([studentId, homeworkId])`** ni ningún índice~~ — **corregido el 2026-07-25**: el schema ya tiene `@@unique([studentId, homeworkId])` (`schema.prisma:403`), `@@index([tenantId, period])` y `@@index([academicYearId])`, y existe `MarksService.upsertMark()` como writer único con auditoría y emisión de `MARK_PUBLISHED` centralizadas. Los duplicados son imposibles a nivel de BD. **Cerrado el 2026-07-26**: los otros dos writers (`homework-submissions.service.ts` y `quiz-attempts.service.ts`) **ya enrutan** por el writer único, así que la auditoría sobre `Mark` y el aviso al alumno dejaron de depender de qué pantalla usó el profesor. Para lograrlo: `AuditService.record()` acepta el cliente de la transacción (obligatorio, porque `audit_logs` tiene FORCE RLS y un insert por `this.prisma` con transacción abierta lo rechaza la política), y `upsertMark()` ganó la variante `upsertMarkInTransaction()` que recibe el `tx` y devuelve un `publish()` que el llamante invoca **después del commit** — emitir adentro notificaría notas que un rollback deshace. `MarksService.resolveMarkYearId()` se eliminó: su lógica quedó dentro del writer, vía el nuevo `MarkWriteInput.academicYearId`. El único camino que sigue con `upsert` inline propio es `bulkCreate`. El comentario en `marks.service.ts:33-36` que dice que "deben pasar por `upsertMark()`" es una intención, no el código. Consecuencias en el ítem siguiente. Ver el contrato en `asignaciones-calificacion-en-linea.md` §2 y el skill `calificaciones`.
- ~~**Bug confirmado el 2026-07-25 — una nota calificada puede ser invisible y no contar para el boletín.**~~ — **corregido el 2026-07-25.** `Mark.academicYearId` es nullable; se agregó el 2026-07-16 (`20260716230000_scope_marks_homework_to_academic_year`) **sin backfill ni default**, y los dos writers sin migrar no lo seteaban. Toda lectura filtra por año: `MarksService.list()` resuelve el año activo si el query no lo trae (`marks.service.ts:160-176`), `/profesor` y `/admin` lo mandan explícito, y **`report-cards.service.ts:148`** filtra `{ studentId, academicYearId: year.id, isPublished: true }`. Resultado: calificar una entrega o enviar un quiz creaba una `Mark` con `academicYearId = null` que el alumno no veía y que **no sumaba al boletín**. **El arreglo** fue: los dos writers ahora resuelven el año vía `MarksService.resolveMarkYearId()` (año del `Homework` si lo tiene, si no el activo del tenant) tanto al crear como al actualizar — así que recalificar sana una nota huérfana — más la migración de backfill `20260725120000_backfill_mark_academic_year`, idempotente, aplicada y verificada (2 notas reparadas). **Cubierto por un test de regresión desde el 2026-07-26** (ver §5, cobertura de tests). Nota: la columna **sigue siendo nullable**, así que un writer nuevo puede reintroducir el problema.
- **Dos caminos de calificación que divergen** — *reducido el 2026-07-26*: calificar desde Entregas ya emite `MARK_PUBLISHED` y audita sobre `Mark`, igual que `/profesor/calificaciones`. Lo que **sigue** divergiendo es que calificar desde `/profesor/calificaciones` **no** marca la entrega como `GRADED`, así que el alumno no ve la retroalimentación asociada. Detalle en `asignaciones-calificacion-en-linea.md` §2.
- **Autocalificar un quiz notifica al alumno solo si el disparador fue el profesor** (decidido e implementado el 2026-07-26). `finalizeAttemptIfComplete` corre en dos momentos opuestos: cuando el alumno envía el quiz (está viendo su puntaje en la respuesta → no se le notifica) y cuando el profesor califica la última respuesta abierta (el alumno no está presente → se le notifica). La asimetría es deliberada y hay un test que falla si se unifica en cualquiera de las dos direcciones.
- **"Editar nota" pisa la nota con 100**: `openGradeDialog` (`homework-editor.tsx:386-391`) precarga siempre `100` en vez de la nota real, porque `submissionSelect()` no incluye la `Mark`. Bug de pérdida de datos.
- **Circuito de calificación con tests, pero parciales** (actualizado el 2026-07-26): hay **dos** tests e2e en `apps/api/test/backend-v1.e2e-spec.ts`. "anchors the mark to the active academic year when grading a submission" cubre `PATCH /homework/:id/submissions/:id/grade` — año académico, sanación de notas huérfanas, visibilidad para el boletín, auditoría sobre `Mark` y notificación. "grades a quiz through the single writer, notifying only when the teacher closes it" cubre los dos disparadores del quiz. De ambos se verificó que **fallan al revertir el comportamiento que afirman** (no solo que pasan en verde). Sigue **sin test**: `POST /homework/:id/submissions`, `POST /marks` / `upsertMark()` directo, y `bulkCreate`.
- ~~**Chat sin tiempo real**~~ — **cerrado el 2026-07-26**, las siete fases de `chat-tiempo-real.md` (ver §2). También se cerró la segunda mitad del ítem: `GET /conversations` ya no era el único acceso al historial, existe `GET /conversations/:id/messages` con cursor. Lo que **sigue** en pie es que el listado embebe los últimos 50 mensajes de cada hilo: aceptable con el techo actual de conversaciones, pero es el próximo cuello si un colegio grande abre cientos de hilos.
- ~~**`system_settings` en el schema pero no en la base**~~ — **corregido el 2026-07-26** con la migración `20260726120000_create_system_settings`. El modelo `SystemSetting` entró al schema en `32770e3` sin migración que lo acompañara, así que la tabla no existió nunca. Dos consecuencias, ambas confirmadas: `settings.service.ts` fallaba con `42P01 relation does not exist` en toda lectura y escritura (el módulo de configuración de SUPER_ADMIN estaba roto de punta a punta), y **`pnpm verify:rls` quedaba permanentemente en rojo** por ese único modelo. Un verificador de aislamiento siempre rojo es peor que ninguno: entrena a ignorarlo. La tabla va deliberadamente **sin RLS** — ya estaba en `GLOBAL_ALLOWLIST` de `scripts/verify-rls.ts` como configuración de plataforma, no de un colegio. Verificado que el rol `classia_app` la lee y escribe sin `GRANT` explícito (hereda el `ALTER DEFAULT PRIVILEGES` de `20260722120000_rls_app_roles`).
- ~~**Quedan 3 diferencias entre `schema.prisma` y la base**~~ — **cerrado el 2026-07-26 con cero SQL**; `prisma migrate diff` ahora devuelve una migración vacía. La corrección fue **en el schema, no en la base**, y esa dirección es el punto: las tres diferencias eran el schema mintiendo sobre la base, no al revés. (a) `auth_sessions_ticketId_fkey` y (b) `access_sessions_approvedById_fkey` tenían `ON DELETE RESTRICT` **a propósito** en sus migraciones — son cadenas de auditoría, y no se quiere que borrar un ticket o un usuario haga desaparecer la sesión asociada. El schema los declaraba como relaciones opcionales, cuyo default en Prisma es `SET NULL`, así que "alinear la base al schema" habría **debilitado la auditoría** sin que nadie lo pidiera. Ahora llevan `onDelete: Restrict` explícito. (c) El índice `support_tickets_assigneeId_idx` existía en la base y el schema no lo declaraba: se agregó el `@@index([assigneeId])`, porque borrarlo era lo único que hacía falta para volver lentas las consultas de la bandeja de soporte.
- ~~**`DATABASE_URL_APP` tiene un fallback silencioso a superusuario**~~ — **corregido el 2026-07-26.** `database.config.ts` hacía `process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL` y `env.schema.ts` la declaraba `.optional()`. Si faltaba, la app arrancaba con el rol `classia` (superuser), que **ignora RLS sin excepción**: las políticas seguían ahí, nada fallaba, y ninguna fila estaba protegida — el modo de falla que CLAUDE.md marca como el más peligroso, y que `verify:rls` no puede detectar porque él se conecta con `DATABASE_URL` a propósito. No estaba ocurriendo (`.env` local no la define, pero `ConfigModule` usa `envFilePath: ["../../.env", "../../.env.example"]`, el primer archivo gana por clave y `.env.example` la provee; verificado en vivo que el runtime conecta como `classia_app`). Ahora el `??` no está y la variable es **obligatoria** en `envSchema`, con el mensaje de error explicando por qué; verificado que el arranque acepta el entorno real y falla sin la variable. **Prerrequisito de despliegue:** cualquier entorno que no defina `DATABASE_URL_APP` y no cargue `.env.example` ahora **no arranca**. Es intencional — es preferible a levantar sin aislamiento — pero hay que tenerlo en cuenta al montar la VPS (`migracion-vps.md`). Conviene además definirla explícitamente en el `.env` local en vez de depender del fallback a `.env.example`.

---

## 6. Prioridad sugerida (no vinculante, para discutir)

> Corregido el 2026-07-16. De la lista anterior, los ítems 2 (entrega de archivos), 3 (CRUD admin), 4 (respuesta corta) y 5 (mensajería) **ya están hechos**. El ítem 1 (portal de familia) sigue abierto pero a medias — ver §3.

**En planeación, con documento propio:**

1. ~~**Chat en tiempo real**~~ → **hecho el 2026-07-26**, las siete fases (ver §2). Lo que quedó explícitamente fuera y **no está aprobado**: llamadas de voz y video — los botones decorativos que las insinuaban se borraron en vez de dejarlos mintiendo.
2. **Calificar asignaciones en línea** → `asignaciones-calificacion-en-linea.md`. El backend ya existe; es desenterrar la UI, arreglar el bug de pérdida de datos y darle una puerta propia. **Tiene frontera estricta con "notas y reportes"** — leer su §2 antes de tocar `Mark`.
3. **Notas y reportes** (dominio de calificaciones/boletines, no confundir con el módulo `reports` de §2) — trabajo paralelo de otro equipo. Su contrato de handoff (5 puntos verificados) está en `asignaciones-calificacion-en-linea.md` §2.
4. **Unificación de UI por rol** → `frontend-unificacion-roles.md`. Nada implementado todavía.

**Sin documento todavía:**

5. **Terminar el portal de familia** — dashboard, `tareas`, `asistencia`, `horario`, `incapacidades`, `ajustes` siguen mock. `familia/tareas` está además bloqueada por permisos de `GUARDIAN`.
6. ~~**`pnpm lint` está roto en todo el repo** por falta de `eslint.config.js` (ESLint v9).~~ **Resuelto** (corrección del 2026-07-25): los configs se agregaron en `e27e4b9` y CI tiene paso de lint desde `94a502b`.
7. **`/registro`** (alta autoservicio de tenant) y **`/recuperar-password`**: sin flujo real.
8. **App móvil (React Native/Expo): sigue en el roadmap, sin fecha** — confirmado con el dueño del producto el 2026-07-25. Nunca se inicializó `apps/mobile`; las variables `EXPO_PUBLIC_*` de `.env.example` están reservadas para cuando arranque. No está descartada, pero tampoco hay nada construido, así que **no se debe escribir código web "preparando" la paridad con una app que no existe**. El brief original que la mandaba "desde la primera versión profesional" está en `archive/01-arquitecto-saas.md`.
9. **Estado de cuenta para familias**: `PAYMENTS_READ_SELF` está concedido a `GUARDIAN` y `STUDENT` (`permissions.ts:524,545`) y `GET /students/:studentId/balance` existe y valida propiedad con `assertCanAccessStudent` — pero **no hay UI**: solo existe `/admin/pagos`, no `/familia/pagos`. Las familias no pueden ver lo que deben. Mismo patrón que `GET /notifications/unread-count` en §4: backend adelantado al frontend. Decisión de producto pendiente, no olvido técnico — sin recaudo en línea (ver `CLAUDE.md`, frontera de Pagos), la pantalla diría "esto debes, ve a pagarlo al banco".
