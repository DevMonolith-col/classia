# Estado del Proyecto — Classia SaaS

> Última actualización: 2026-07-13, rama `prototype-2`.
> Este documento reemplaza a `roadmap-prototype-2.md` como fuente de verdad del estado actual — ese archivo quedó desactualizado (fue escrito antes de construir materias, horarios, asistencia, calificaciones, tareas, etc., que hoy ya existen). Se deja como referencia histórica, no se debe seguir usando para saber qué falta.

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

### Portal del estudiante (`/alumno`) — nuevo, construido en esta sesión
- Login propio (antes los estudiantes no podían iniciar sesión — se agregó `Student.userId`).
- Lista de asignaciones con estado y tipo.
- **Motor de quices real**: iniciar intento, responder pregunta por pregunta (respeta modo libre/secuencial del profesor), autoguardado, envío, autocalificación de preguntas de opción múltiple/verdadero-falso, resultado con retroalimentación por opción e imágenes.
- Al enviar un quiz, se crea/actualiza automáticamente una `Mark` que alimenta la tabla de calificaciones del profesor — el circuito está cerrado de punta a punta.
- Vista de calificaciones propias.

### Backend — módulos reales (`apps/api/src/modules/`)
`auth`, `bootstrap`, `tenants`, `users`, `groups`, `students`, `teachers`, `guardians`, `subjects`, `schedules`, `attendance`, `marks`, `homework`, `questions`, `quiz-attempts`, `files`, `audit`, `health`.

---

## 3. Lo que es mock / no funcional todavía

Estas páginas existen visualmente (con buen diseño) pero **no hacen ninguna llamada a la API** — son arrays hardcodeados:

### Portal de familia/acudientes (`/familia/*`) — completo, sin excepción
`page.tsx` (dashboard), `calificaciones`, `tareas`, `asistencia`, `horario`, `mensajes`, `incapacidades`, `ajustes`. **Ninguna de estas 8 páginas está conectada.** El acudiente sí puede iniciar sesión (el modelo `Guardian` ya tiene `userId` desde antes), pero no ve ningún dato real de sus hijos.

### Panel del colegio (`/admin`) — pendientes
- `page.tsx` (Dashboard): stats hardcodeadas.
- `estudiantes`, `profesores`, `cursos`: **el backend ya tiene CRUD completo** (`/students`, `/teachers`, `/groups`) pero estas pantallas de administración no están conectadas.
- `mensajes`, `calendario`, `reportes`, `configuracion`, `plugins`, `plugins/desarrolladores`: sin backend ni conexión.

### Panel del profesor (`/profesor`) — pendientes
- `page.tsx` (Mi Panel / dashboard): horario y stats hardcodeados, con enlaces rotos (`/profesor/tareas/nueva`, `/profesor/mensajes/nuevo`, etc. que ya no existen).
- `horario`, `mensajes`, `configuracion`: sin conectar.

### Otros
- `/registro`: formulario de planes estático, no crea un tenant real (el endpoint `POST /tenants` existe pero requiere permiso de administrador — no hay alta autoservicio).
- `/recuperar-password`: sin flujo real de recuperación.

---

## 4. Modelos de base de datos sin ninguna funcionalidad encima

Existen en `schema.prisma` pero **cero** código en `apps/api` o `apps/web` los usa:

- **`Message`** — mensajería entre usuarios. Explica por qué `mensajes` está mock en los 3 portales.
- **`Announcement`** — cartelera de comunicados.
- **`HomeworkSubmission`** — el estudiante puede *tomar un quiz*, pero no puede **subir un archivo** para una Tarea o Proyecto (solo el profesor sube material). El modelo ya tiene `attachmentKey`/`attachmentName`/`status`/`submittedAt`, listo para usarse.

## 5. Deuda técnica / decisiones tomadas conscientemente que valen la pena revisar

- **Calificación manual de "Respuesta corta"**: las preguntas tipo texto libre en un quiz quedan con `pointsAwarded: null` tras enviarse — no hay vista para que el profesor las revise y puntúe manualmente. El intento queda en estado `SUBMITTED` (no `GRADED`) y no genera `Mark` hasta que eso se resuelva.
- **`/admin/asignaciones` es de solo lectura** por decisión de consistencia con `/admin/asistencia` y `/admin/calificaciones` (patrón "el profesor gestiona, el admin audita"). Si se necesita que un admin pueda editar/eliminar una asignación de cualquier profesor, hay que decidir esa UX explícitamente.
- **Scoping de `GUARDIAN` inexistente en el backend**: incluso si se construyera el frontend de `/familia`, `marks.service.ts`, `homework.service.ts` y `attendance.service.ts` no tienen ninguna rama para el rol `GUARDIAN` (a diferencia de `TEACHER` y `STUDENT`, que sí están correctamente scopeados). Habría que construir el equivalente de `resolveOwnStudentId` pero para "hijos de este acudiente" antes de exponer datos.
- **Permisos de `GUARDIAN`** en `permissions.ts` son casi nulos (`USERS_READ_SELF`, `USERS_READ_MEMBERSHIPS`) — habría que extenderlos como se hizo con `STUDENT` en esta sesión.

---

## 6. Prioridad sugerida (no vinculante, para discutir)

1. **Portal de familia** — es el hueco más grande y visible: 8 pantallas mock, cero backend scopeado. Es el mismo trabajo que ya se hizo para `/alumno`, pero para acudientes viendo a sus hijos.
2. **Entrega de archivos del estudiante** (`HomeworkSubmission`) — cierra el ciclo de Tareas/Proyectos igual que el motor de quices cerró el de Quiz/Examen.
3. **CRUD admin de Estudiantes/Profesores/Cursos** — el backend ya existe, es "solo" construir las 3 pantallas.
4. **Calificación manual de respuesta corta** — completa el motor de quices.
5. **Mensajería** (`Message`/`Announcement`) — afecta a los 3 portales a la vez, conviene planearlo como un solo esfuerzo en vez de 3.
