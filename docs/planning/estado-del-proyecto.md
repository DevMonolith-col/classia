# Estado del Proyecto — Classia SaaS

> Última actualización: 2026-07-16, rama `develop`.
> Este documento reemplaza a `roadmap-prototype-2.md` como fuente de verdad del estado actual — ese archivo quedó desactualizado (fue escrito antes de construir materias, horarios, asistencia, calificaciones, tareas, etc., que hoy ya existen). Se deja como referencia histórica, no se debe seguir usando para saber qué falta.
>
> **Corrección del 2026-07-16**: la versión anterior de este documento (2026-07-13) quedó obsoleta en cuestión de horas — el commit `5e93a6a` del mismo día, y después toda la mensajería (`4e3517c`..`f6bc554`), invalidaron varias de sus afirmaciones. Decía que `Message`/`Announcement`/`HomeworkSubmission` eran modelos fantasma, que no existía la calificación manual de respuesta corta, que `GUARDIAN` no tenía scoping ni permisos, y que `/familia/*` estaba mock sin excepción: **todas eran falsas**. Se corrigieron abajo. Lección para el próximo que edite este archivo: fecharlo y verificar contra el código, no contra la memoria.
>
> **Corrección del 2026-07-19** (rama `feature/reportes-reales`): este documento (§3, línea 96 en su momento) decía que `/admin/reportes` estaba "sin backend ni conexión". **Ya no es cierto**: entre el 2026-07-18 y el 2026-07-19 se construyó el módulo `reports` completo (6 tipos de reporte con queries reales, generación async PDF/CSV vía BullMQ, historial, programación recurrente con reprogramación dinámica) y el módulo `payments` (conceptos de cobro, facturas, pagos, resumen financiero). Ambos verificados end-to-end en navegador real (preview → generar → descargar → programar → eliminar) el 2026-07-19. Además, esa misma rama pasó por una auditoría de seguridad de 6 fases sobre TODO el diff acumulado (no solo reportes) — ver `auditoria-seguridad-2026-07.md` para el detalle completo (hallazgos, decisiones tomadas y verificación de cada fase).

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
`auth`, `bootstrap`, `tenants`, `users`, `groups`, `students`, `teachers`, `guardians`, `subjects`, `schedules`, `attendance`, `marks`, `homework`, `homework-submissions`, `questions`, `quiz-attempts`, `conversations`, `announcements`, `notifications`, `events`, `files`, `audit`, `health`.

### Mensajería, comunicados y notificaciones — construido entre el 2026-07-13 y el 14
- **Chat 1:1 real** (`conversations`): reemplazó el modelo `Message` por `Conversation`/`ConversationMember`/`ConversationMessage`. Scoping "el acudiente solo escribe a los profesores de sus hijos" derivado de `Schedule`. Soft-delete que conserva la fila (retención obligatoria por Ley 1620 y Ley 527). **No tiene tiempo real** — ver `chat-tiempo-real.md`.
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
- `page.tsx` (Dashboard): stats hardcodeadas.
- `calendario`, `configuracion`, `plugins`, `plugins/desarrolladores`: sin backend ni conexión.
- (`reportes` y `pagos` ya se conectaron el 2026-07-18/19 — ver §2.)
- `mensajes/nuevo`: **página muerta** ("Próximamente...") — el módulo de mensajería lleva conectado desde `eda38c4` y la composición vive dentro del panel. Los quick-actions del dashboard todavía apuntan a esa ruta muerta.
- (`estudiantes`, `profesores`, `cursos` ya se conectaron en `1f9870b`.)

### Panel del profesor (`/profesor`) — pendientes
- `horario`, `configuracion`: sin conectar.
- `mensajes/nuevo`: página muerta, igual que la de admin.
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
- **`ConversationMember.mutedAt`** (`:462`) — jamás leído ni escrito. Ver `chat-tiempo-real.md`, Fase 7.
- **`HomeworkSubmission.status = "PENDING"`** (`:412`) — es el default del schema pero es **inalcanzable**: ningún camino crea una submission sin `status` explícito. La UI tiene label y color para él y nunca se renderiza.
- **`NotificationChannel.IN_APP`** (`:544`) — declarado, pero las notificaciones in-app se crean como fila `Notification` directa; solo EMAIL genera `NotificationDelivery`. Patrón asimétrico a tener en cuenta si se agrega un canal PUSH/WS.
- **`GET /notifications/unread-count`** (`notifications.controller.ts:22-25`) — existe en el backend y **cero archivos de `apps/web` lo llaman**. Por eso la campanita no tiene badge.

## 5. Deuda técnica / decisiones tomadas conscientemente que valen la pena revisar

- **`/admin/asignaciones` es de solo lectura** por decisión de consistencia con `/admin/asistencia` y `/admin/calificaciones` (patrón "el profesor gestiona, el admin audita"). Si se necesita que un admin pueda editar/eliminar una asignación de cualquier profesor, hay que decidir esa UX explícitamente. Ojo: `permissions.ts` **ya da** `HOMEWORK_SUBMISSIONS_GRADE` a los 4 roles de admin — hay permiso de backend sin UI.
- **`Mark` no tiene `@@unique([studentId, homeworkId])`** ni ningún índice, y tiene **3 writers independientes** (`homework-submissions.service.ts`, `quiz-attempts.service.ts`, `marks.service.ts`) haciendo `findFirst` → `update`/`create` sin protección. Permite notas duplicadas para la misma tarea+alumno. Ver el contrato en `asignaciones-calificacion-en-linea.md` §2.
- **Dos caminos de calificación que divergen**: calificar desde `/profesor/calificaciones` **no** marca la entrega como `GRADED` (el alumno nunca ve la retroalimentación), y calificar desde Entregas **no** emite `MARK_PUBLISHED` (el alumno no se entera de su nota). Ambos escriben `Mark.value` correctamente. Detalle en `asignaciones-calificacion-en-linea.md` §2.
- **"Editar nota" pisa la nota con 100**: `openGradeDialog` (`homework-editor.tsx:386-391`) precarga siempre `100` en vez de la nota real, porque `submissionSelect()` no incluye la `Mark`. Bug de pérdida de datos.
- **Cero tests del circuito de calificación**: no hay ni un test de `POST /homework/:id/submissions`, `PATCH .../grade`, `quiz-attempts` ni `POST /marks`.
- **Chat sin tiempo real**: la UI de mensajes solo se refresca al montar o al enviar — un mensaje entrante no aparece hasta un F5. Además `GET /conversations` devuelve el historial completo de todos los hilos sin paginar. Ver `chat-tiempo-real.md`.

---

## 6. Prioridad sugerida (no vinculante, para discutir)

> Corregido el 2026-07-16. De la lista anterior, los ítems 2 (entrega de archivos), 3 (CRUD admin), 4 (respuesta corta) y 5 (mensajería) **ya están hechos**. El ítem 1 (portal de familia) sigue abierto pero a medias — ver §3.

**En planeación, con documento propio:**

1. **Chat en tiempo real** → `chat-tiempo-real.md`. Alcance aprobado: completo estilo WhatsApp. Su Fase 0 (paginar `GET /conversations`, que hoy trae el historial completo de todos los hilos) es mergeable sola y ya mejora el producto.
2. **Calificar asignaciones en línea** → `asignaciones-calificacion-en-linea.md`. El backend ya existe; es desenterrar la UI, arreglar el bug de pérdida de datos y darle una puerta propia. **Tiene frontera estricta con "notas y reportes"** — leer su §2 antes de tocar `Mark`.
3. **Notas y reportes** (dominio de calificaciones/boletines, no confundir con el módulo `reports` de §2) — trabajo paralelo de otro equipo. Su contrato de handoff (5 puntos verificados) está en `asignaciones-calificacion-en-linea.md` §2.
4. **Unificación de UI por rol** → `frontend-unificacion-roles.md`. Nada implementado todavía.

**Sin documento todavía:**

5. **Terminar el portal de familia** — dashboard, `tareas`, `asistencia`, `horario`, `incapacidades`, `ajustes` siguen mock. `familia/tareas` está además bloqueada por permisos de `GUARDIAN`.
6. **`pnpm lint` está roto en todo el repo** por falta de `eslint.config.js` (ESLint v9). Preexistente, no lo rompió ninguna feature reciente.
7. **`/registro`** (alta autoservicio de tenant) y **`/recuperar-password`**: sin flujo real.
