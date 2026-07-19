# Especificación Técnica de Proyecto — Classia SaaS

> Generado el 2026-07-13, en base a auditoría real del código en la rama `prototype-2` (ver [`estado-del-proyecto.md`](./estado-del-proyecto.md) como fuente primaria de este documento) y del `schema.prisma` completo. Pensado para repartir el backlog entre el equipo de desarrollo vía GitHub Issues.

---

## 1. Descripción General

**Classia** es un SaaS multi-tenant de gestión escolar para colegios en Sudamérica. Un mismo despliegue (backend + base de datos) sirve a múltiples colegios (`tenants`) aislados lógicamente por `tenantId`, resueltos por header `x-tenant-slug` en desarrollo y por subdominio/hostname en producción.

**Objetivo principal:** ofrecer a un colegio un sistema único donde:
- La administración del colegio gestiona estudiantes, profesores, cursos, horarios y materias.
- Los profesores toman asistencia, registran calificaciones y publican tareas/exámenes/quices.
- Los estudiantes presentan quices en línea, entregan tareas y consultan sus notas.
- Los acudientes (familia) hacen seguimiento de sus hijos.
- Un SuperAdmin opera la plataforma completa: alta de colegios, usuarios globales y auditoría.

**Stack tecnológico:**

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack/Webpack), React 19, Tailwind CSS 4, shadcn/ui (Radix), react-hook-form + zod, KaTeX (fórmulas), recharts |
| Backend | NestJS 11, Zod para validación, JWT (`@nestjs/jwt`) + refresh tokens rotativos, bcryptjs |
| Base de datos | PostgreSQL vía Prisma 5 (`packages/database`) |
| Cola / cache | Redis + BullMQ (`@nestjs/bullmq`), infraestructura lista, sin jobs productivos aún |
| Almacenamiento | S3-compatible (MinIO en dev, pensado para Cloudflare R2/AWS S3 en prod) vía `@aws-sdk/client-s3`, URLs firmadas |
| Infraestructura local | `docker-compose.yml` → Postgres, Redis, MinIO |
| Monorepo | pnpm workspaces (`apps/web`, `apps/api`, `packages/database`, `packages/shared`, `packages/validators`) |

---

## 2. Arquitectura y Estructura de Carpetas

```
classia-saas/
├── apps/
│   ├── web/                          # Next.js — frontend
│   │   ├── app/
│   │   │   ├── admin/                # Panel del colegio (TENANT_ADMIN, PRINCIPAL, etc.)
│   │   │   ├── profesor/             # Panel del docente
│   │   │   ├── alumno/               # Portal del estudiante
│   │   │   ├── familia/              # Portal del acudiente (hoy 100% mock)
│   │   │   ├── superadmin/           # Panel de operación SaaS global
│   │   │   ├── login/, registro/, recuperar-password/
│   │   │   └── ...
│   │   ├── components/               # Componentes por dominio (admin/, profesor/, alumno/, superadmin/, shared/)
│   │   ├── lib/                      # auth.ts, api-client.ts
│   │   └── middleware.ts             # Protección de rutas por rol
│   │
│   ├── api/                          # NestJS — backend
│   │   └── src/
│   │       ├── modules/              # auth, bootstrap, tenants, users, groups, students, teachers,
│   │       │                         # guardians, subjects, schedules, attendance, marks, homework,
│   │       │                         # questions, quiz-attempts, files, audit, health
│   │       ├── common/permissions/   # Modelo RBAC (permissions.ts)
│   │       ├── core/storage/         # Cliente S3-compatible
│   │       └── app.setup.ts          # CORS, helmet, trust proxy
│   │
│   └── mobile/                       # NO EXISTE — planeado (React Native/Expo), nunca inicializado
│
├── packages/
│   ├── database/                     # Prisma schema, migraciones, seed
│   ├── shared/                       # Tipos y constantes compartidas
│   └── validators/                   # Esquemas Zod compartidos
│
├── docs/
│   ├── api/frontend-contract.md      # Contrato API ↔ frontend
│   └── planning/                     # Documentos de planeación (este archivo incluido)
│
└── docker-compose.yml                # postgres, redis, minio
```

**Multi-tenancy:** cada tabla de dominio (`students`, `groups`, `subjects`, `marks`, etc.) tiene `tenantId`. El aislamiento se aplica a nivel de servicio (no hay row-level security de Postgres), filtrando siempre por `tenantId` resuelto en el request.

**RBAC:** 9 roles (`SUPER_ADMIN`, `SUPPORT_AGENT`, `TENANT_ADMIN`, `PRINCIPAL`, `COORDINATOR`, `SECRETARY`, `TEACHER`, `GUARDIAN`, `STUDENT`), permisos declarados en `apps/api/src/common/permissions/permissions.ts`, consumidos en frontend vía `/app/bootstrap`.

---

## 3. Requerimientos Funcionales y No Funcionales

### 3.1 Funcionales — por rol

**SuperAdmin**
- Crear, editar y suspender tenants (colegios).
- Ver usuarios globales y auditoría completa con diff old/new.
- Gestionar soporte, seguridad y configuración de la plataforma (parcialmente pendiente, ver backlog).

**Administración de colegio** (`TENANT_ADMIN`/`PRINCIPAL`/`COORDINATOR`/`SECRETARY`)
- CRUD de estudiantes, profesores, cursos/grupos, materias y horarios.
- Auditar (solo lectura) asistencia, calificaciones y asignaciones de todos los profesores.
- Ver estadísticas reales del colegio en su dashboard.

**Profesor**
- Ver sus materias/grupos asignados ("Mis Clases").
- Crear tareas, exámenes, quices y proyectos, con banco de preguntas, imágenes, LaTeX y modo de navegación libre/secuencial.
- Tomar asistencia por sesión.
- Registrar y consultar calificaciones (hoja de cálculo ponderada).
- Calificar manualmente respuestas de texto libre en quices (pendiente).

**Estudiante**
- Iniciar sesión con cuenta propia.
- Ver asignaciones pendientes/entregadas.
- Presentar quices en línea con autocalificación y feedback.
- Entregar archivos para tareas/proyectos (pendiente — modelo listo, sin UI/API).
- Consultar sus propias calificaciones.

**Familia / Acudiente**
- Iniciar sesión con cuenta propia (ya soportado a nivel de modelo).
- Ver calificaciones, tareas, asistencia, horario, comunicados y mensajes de sus hijos (**100% pendiente**, hoy es solo maquetación mock).

### 3.2 No funcionales

- **Aislamiento multi-tenant estricto**: ningún endpoint debe filtrar datos de un tenant hacia otro.
- **Seguridad**: contraseñas con bcrypt, JWT de corta duración + refresh rotativo, sesiones revocables, CORS dinámico por subdominio de tenant, `helmet`.
- **Auditoría**: toda acción sensible (creación/edición de datos institucionales) debe quedar registrada en `AuditLog` con actor, entidad, valores antes/después e IP real (vía `trust proxy`).
- **Disponibilidad de archivos**: adjuntos e imágenes servidos por URLs firmadas con expiración, nunca públicos por defecto.
- **Resiliencia de UI**: toda pantalla que consuma la API debe manejar estados de carga, error y vacío — no se permite dejar una pantalla en blanco o rota si la API falla.
- **Rate limiting**: rutas críticas como `/auth/login` deben protegerse contra fuerza bruta (pendiente, ver backlog).
- **Consistencia de datos**: los formularios de calificación/asistencia deben respetar los límites definidos en Prisma (ej. `maxValue`, unicidad `[tenantId, documentId]`, `[sessionId, studentId]`, etc.) sin duplicar registros.

---

## 4. Backlog de Tareas (para GitHub Issues)

### 4.0 Resumen de lo ya construido (contexto, no son tareas nuevas)

Para que el equipo no reabra trabajo ya hecho: autenticación completa con JWT/refresh, bootstrap por rol, auditoría automática, storage S3 con URLs firmadas, SuperAdmin (dashboard, tenants, usuarios globales, auditoría) 100% real, `/admin` con asignaciones/asistencia/calificaciones/horarios/materias conectados, `/profesor` completo (clases, asignaciones con banco de preguntas + LaTeX + imágenes, calificaciones, asistencia), y `/alumno` completo (login, asignaciones, motor de quices de punta a punta, calificaciones propias). Backend con 17 módulos reales: `auth, bootstrap, tenants, users, groups, students, teachers, guardians, subjects, schedules, attendance, marks, homework, questions, quiz-attempts, files, audit, health`.

Todo lo que sigue abajo es lo que **falta**.

---

### Épica A — Portal de Familia / Acudientes

#### [BE] Scoping de rol GUARDIAN en servicios académicos
**Descripción:** `marks.service.ts`, `homework.service.ts` y `attendance.service.ts` no tienen ninguna rama para `GUARDIAN` (a diferencia de `TEACHER`/`STUDENT`). Construir el equivalente de `resolveOwnStudentId` pero resolviendo "hijos de este acudiente" vía `StudentGuardian`, y aplicarlo como filtro en cada consulta relevante.
**DoD:**
- Un usuario `GUARDIAN` autenticado solo puede leer datos (marks, homework, attendance) de estudiantes donde exista un `StudentGuardian` vinculado a su `Guardian.id`.
- Intentar consultar un estudiante ajeno devuelve 403/404, no data leak.
- Tests unitarios cubriendo el resolver de hijos del acudiente.

#### [BE] Ampliar permisos de GUARDIAN en permissions.ts
**Descripción:** Hoy `GUARDIAN` solo tiene `USERS_READ_SELF` y `USERS_READ_MEMBERSHIPS`. Extender con permisos de lectura equivalentes a los usados por `STUDENT` para marks/homework/attendance, pero scopeados a hijos.
**DoD:** Permisos nuevos documentados en `permissions.ts`, cubiertos por el guard RBAC existente, sin afectar otros roles.

#### [FE] Conectar `/familia` (dashboard)
**Descripción:** Reemplazar el array hardcodeado de `apps/web/familia/page.tsx` por datos reales del/los hijo(s) del acudiente vía `apiFetch` (usar el bootstrap o un endpoint agregador nuevo).
**DoD:** Loading/error/empty state; si tiene más de un hijo, selector de estudiante; cero datos mock visibles.

#### [FE] Conectar `/familia/calificaciones`
**Descripción:** Consumir `GET /marks` scopeado (ver Épica A backend) para mostrar notas reales del hijo seleccionado.
**DoD:** Igual estructura visual que hoy, pero 100% datos reales, con manejo de múltiples hijos.

#### [FE] Conectar `/familia/tareas`
**Descripción:** Listar asignaciones (`Homework`) del/los hijo(s), con estado de entrega si aplica.
**DoD:** Datos reales, estado "entregado"/"pendiente"/"vencido" coherente con `dueDate`/`cutOffDate`.

#### [FE] Conectar `/familia/asistencia`
**Descripción:** Mostrar historial de `AttendanceRecord` del/los hijo(s).
**DoD:** Datos reales, filtrable por rango de fechas si el diseño actual lo contempla.

#### [FE] Conectar `/familia/horario`
**Descripción:** Mostrar el horario semanal (`Schedule`) del grupo del hijo seleccionado.
**DoD:** Datos reales, coherente con la vista de horario ya usada en `/admin/horarios`.

#### [FULL] Conectar `/familia/mensajes` y `/familia/incapacidades`
**Descripción:** Depende de la Épica E (Mensajería). `incapacidades` (excusas médicas) no tiene modelo en Prisma — definir si se modela como sub-tipo de `Message`/`Announcement` o requiere modelo propio antes de implementar.
**DoD:** Decisión de modelado documentada; implementación según Épica E.

#### [FE] Conectar `/familia/ajustes`
**Descripción:** Pantalla de configuración de cuenta del acudiente (datos de contacto, notificaciones).
**DoD:** Al menos edición de datos de contacto propios vía endpoint de `users` existente.

---

### Épica B — Entrega de archivos del estudiante (`HomeworkSubmission`)

#### [BE] Endpoints CRUD de `HomeworkSubmission`
**Descripción:** El modelo ya existe (`attachmentKey`, `attachmentName`, `status`, `submittedAt`, `feedbackComment`, `feedbackKey/Name`, `gradedAt`) pero no hay controller/service. Crear módulo `homework-submissions` (o extender `homework`) con: subir entrega (estudiante), listar entregas de una tarea (profesor), calificar/dar feedback con archivo (profesor).
**DoD:**
- `POST` entrega usa el flujo de `files` module existente para adjuntos.
- Solo el `STUDENT` dueño puede crear/editar su propia entrega mientras esté `PENDING`.
- El `TEACHER` de la materia puede leer todas las entregas de su tarea y calificarlas.
- Auditoría registra la calificación de una entrega.

#### [FE] UI de entrega de archivo en `/alumno/asignaciones`
**Descripción:** Para tareas/proyectos de tipo distinto a quiz, agregar flujo de subida de archivo (reutilizar `file-upload-field.tsx`).
**DoD:** Estudiante puede subir, reemplazar (mientras esté `PENDING`) y ver el estado de su entrega.

#### [FE] UI de revisión de entregas en `/profesor/asignaciones`
**Descripción:** Vista para que el profesor liste entregas de una tarea, descargue el adjunto, y registre nota + feedback (texto y/o archivo).
**DoD:** Al calificar, se genera/actualiza automáticamente una `Mark` igual que hace hoy el motor de quices.

---

### Épica C — CRUD administrativo de Estudiantes / Profesores / Cursos

#### [FE] `/admin/estudiantes`
**Descripción:** El backend (`/students`) ya soporta CRUD completo. Construir listado con filtros (grupo, activo/inactivo), alta, edición y vínculo con acudientes.
**DoD:** Loading/error/empty; validación de documento duplicado por tenant reflejada como error de UI legible.

#### [FE] `/admin/profesores`
**Descripción:** Igual que estudiantes, usando `/teachers`.
**DoD:** CRUD completo conectado, sin mocks.

#### [FE] `/admin/cursos`
**Descripción:** Igual, usando `/groups`.
**DoD:** CRUD completo conectado; al eliminar/editar un grupo, reflejar impacto en horarios asociados (o bloquear si tiene dependencias, a decidir con el equipo).

---

### Épica D — Calificación manual de respuesta corta

#### [BE] Endpoint de calificación manual de `QuizAnswer` tipo texto libre
**Descripción:** Hoy las preguntas de respuesta corta quedan con `pointsAwarded: null` y el intento se congela en `SUBMITTED` sin generar `Mark`. Crear endpoint para que el profesor asigne puntos a cada `QuizAnswer` de texto libre pendiente de un intento.
**DoD:** Al calificar todas las respuestas pendientes de un intento, el estado pasa a `GRADED`, se recalcula `score`, y se genera/actualiza la `Mark` correspondiente (mismo flujo que el resto del motor de quices).

#### [FE] Vista de calificación manual para el profesor
**Descripción:** Pantalla (o sección dentro de `/profesor/calificaciones` o `/profesor/asignaciones`) que liste intentos `SUBMITTED` con respuestas de texto libre pendientes de calificar.
**DoD:** El profesor puede ver la respuesta del estudiante, asignar puntaje por pregunta, y confirmar; refleja el nuevo estado `GRADED` inmediatamente.

---

### Épica E — Mensajería y Comunicados

#### [BE] Módulo `messages`
**Descripción:** CRUD sobre el modelo `Message` (ya existe en Prisma): enviar, listar bandeja de entrada/salida, marcar como leído. Scopear por tenant y por participante (`fromId`/`toId`).
**DoD:** Un usuario solo puede leer mensajes donde es `from` o `to`; auditoría no aplica (es comunicación, no dato sensible institucional) salvo que el equipo decida lo contrario.

#### [BE] Módulo `announcements`
**Descripción:** CRUD sobre `Announcement` con `targetRole` opcional (para filtrar cartelera por rol destinatario).
**DoD:** Solo roles administrativos (`TENANT_ADMIN`/`PRINCIPAL`/`COORDINATOR`/`SECRETARY`) pueden crear/editar; cualquier rol autenticado del tenant puede leer los comunicados dirigidos a su rol o a "todos".

#### [FE] Bandeja de mensajes en los 3 portales
**Descripción:** Conectar `/admin/mensajes`, `/profesor/mensajes`, `/familia/mensajes` (y agregar en `/alumno` si el diseño lo contempla) al módulo `messages`.
**DoD:** Enviar, listar, marcar como leído funcionando en los 3+ portales con el mismo componente compartido.

#### [FE] Cartelera de comunicados
**Descripción:** Mostrar `Announcement` en los dashboards de cada portal según `targetRole`.
**DoD:** Comunicados visibles según rol, con fecha y autor.

---

### Épica F — Paneles con datos simulados / navegación rota

#### [FE] `/admin` dashboard — reemplazar stats hardcodeadas
**Descripción:** Conectar el dashboard principal del panel de colegio a datos reales (conteo de estudiantes, profesores, asistencia del día, etc.), reutilizando endpoints ya existentes.
**DoD:** Cero valores hardcodeados; loading/error/empty correctos.

#### [FE] `/profesor` dashboard — reemplazar stats y arreglar enlaces rotos
**Descripción:** El horario y stats del panel principal del profesor están hardcodeados, y hay enlaces a rutas que ya no existen (`/profesor/tareas/nueva`, `/profesor/mensajes/nuevo`). Conectar a datos reales y actualizar los enlaces a las rutas vigentes (`/profesor/asignaciones/nueva`, etc.).
**DoD:** Sin enlaces rotos (verificar cada `href` contra rutas existentes), datos reales.

#### [FE] `/admin/horario` (vista propia de administración, si aplica) y `/profesor/horario`
**Descripción:** Conectar a `Schedule` real si aún no está cubierto por `/admin/horarios`.
**DoD:** Confirmar si esta ruta es redundante con `/admin/horarios` antes de duplicar esfuerzo; si es redundante, eliminarla y redirigir.

#### [FE] `/admin/configuracion`, `/profesor/configuracion`
**Descripción:** Pantallas de configuración de cuenta/tenant, hoy sin conexión.
**DoD:** Al menos edición de datos propios del usuario funcionando; configuración a nivel tenant (branding, timezone) solo si se decide alcance con el equipo.

#### [FE] `/admin/plugins`, `/admin/plugins/desarrolladores`
**Descripción:** Sin backend ni conexión. Depende de que se decida implementar el sistema de feature flags descrito en `plugins.md` — no priorizar hasta que exista al menos un plugin real que integrar (ver `plugins.md`, Fase 1: pasarela de pagos).
**DoD:** Marcar explícitamente como "próximamente" en la UI hasta que haya alcance definido, en vez de dejar la navegación rota.

#### [FE] `/admin/reportes`
**Descripción:** Sin backend ni conexión — definir qué reportes son prioritarios (boletines, asistencia consolidada) antes de implementar.
**DoD:** Documento de alcance mínimo aprobado antes de codear (evitar over-engineering).

---

### Épica G — SuperAdmin: subrutas pendientes

#### [FULL] `/superadmin/support`
**Descripción:** Sección de soporte mencionada en el sidebar pero sin ruta real ni contrato de backend definido.
**DoD:** Definir alcance mínimo (¿tickets? ¿acceso de soporte a tenants?) antes de codear; implementar ruta real, sin navegación rota.

#### [FULL] `/superadmin/security`
**Descripción:** Igual, sin alcance definido aún.
**DoD:** Definir alcance con el equipo (¿políticas de contraseña? ¿sesiones activas globales?) antes de implementar.

#### [FULL] `/superadmin/settings`
**Descripción:** Configuración global de la plataforma (branding por defecto, dominios, etc.).
**DoD:** Definir alcance mínimo viable con el equipo antes de implementar.

---

### Épica H — Onboarding y autoservicio

#### [FULL] Alta de tenant autoservicio desde `/registro`
**Descripción:** Hoy `/registro` es un formulario estático; `POST /tenants` existe pero requiere permiso de admin. Decidir si se habilita alta autoservicio (con verificación de email/pago) o si `/registro` pasa a ser solo un formulario de contacto comercial.
**DoD:** Decisión de producto documentada; si se aprueba autoservicio, implementar flujo completo (creación de tenant + primer `TENANT_ADMIN` + verificación).

#### [BE] Flujo real de recuperación de contraseña
**Descripción:** `/recuperar-password` no tiene flujo real. Implementar: solicitud → email con token de un solo uso → reseteo.
**DoD:** Token expira, es de un solo uso, y se registra en auditoría; requiere definir proveedor de envío de email (no existe integración de email en el proyecto hoy — es una dependencia previa).

---

### Épica I — Infraestructura y seguridad

#### [BE] Rate limiting en rutas críticas
**Descripción:** Agregar `nestjs-throttler` (o equivalente) en `/auth/login` y otras rutas sensibles a fuerza bruta.
**DoD:** Límite configurable por IP/usuario; respuesta 429 clara; no bloquea flujos legítimos de uso normal (ajustar umbral con el equipo).

#### [BE] Carga masiva de estudiantes/profesores (CSV/Excel)
**Descripción:** Importador para que un colegio cargue su padrón inicial sin alta uno por uno.
**DoD:** Valida duplicados (`[tenantId, documentId]`), reporta filas con error sin abortar el resto del archivo, genera resumen de importación.

#### [FULL] Inicialización de `apps/mobile` (React Native/Expo)
**Descripción:** Workspace mobile mencionado en `package.json`/roadmap pero nunca creado. No priorizar hasta que el resto del piloto web esté estable (portal de familia, entregas de tareas).
**DoD:** Fuera de alcance hasta decisión explícita del equipo — dejar como backlog, no como sprint activo.

---

## 5. Prioridad sugerida

1. **Épica A — Portal de familia** (mayor hueco visible, mismo patrón ya validado con `/alumno`).
2. **Épica B — Entrega de archivos del estudiante** (cierra el ciclo de Tareas/Proyectos).
3. **Épica C — CRUD admin de Estudiantes/Profesores/Cursos** (backend ya existe, solo falta UI).
4. **Épica D — Calificación manual de respuesta corta** (completa el motor de quices).
5. **Épica F — Limpieza de dashboards mock y enlaces rotos** (bajo esfuerzo, alto impacto de percepción de calidad).
6. **Épica E — Mensajería** (afecta a los 3 portales, planear como un solo esfuerzo).
7. **Épica G, H, I** — según roadmap comercial y decisiones de producto pendientes.
