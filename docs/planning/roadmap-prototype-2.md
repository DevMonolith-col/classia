# Hoja de Ruta y Estado del Proyecto (prototype-2) — Classia SaaS

Este documento recopila el estado actual del monorepo en la rama `prototype-2` (creada a partir de `super-admin-frontend`), y define la hoja de ruta técnica para el desarrollo y estabilización del software multi-tenant.

---

## 1. Escaneo General del Monorepo

El proyecto está planteado como un monorepo administrado por **pnpm workspaces**:

```txt
classia-saas/
├── apps/
│   ├── web/            # Aplicación Next.js (App Router, Tailwind CSS)
│   └── api/            # API NestJS (TypeScript, Prisma)
├── packages/
│   ├── database/       # Cliente de base de datos (Prisma schema, migraciones y seeds)
│   ├── shared/         # Tipos y constantes compartidas
│   └── validators/     # Esquemas de validación Zod
├── docs/
│   ├── agents/         # Documentación de los agentes de desarrollo
│   ├── api/            # Contrato API frontend-backend
│   └── planning/       # Planes de incremento técnico
├── docker-compose.yml  # Entornos locales (PostgreSQL, Redis)
└── pnpm-workspace.yaml # Definición de los workspaces
```

> [!NOTE]
> La aplicación móvil (`apps/mobile` en React Native + Expo) planificada en los documentos de diseño **aún no está inicializada** en el monorepo.

---

## 2. Estado Actual del Proyecto ("Qué ya está listo")

El desarrollo en la rama `prototype-2` avanzó considerablemente, integrando las bases del panel global de superadministración y los primeros módulos académicos en el backend.

### Backend (NestJS / Prisma)
* **Resolución Multi-Tenant:** Implementada mediante el middleware/guard que extrae el `x-tenant-slug` en desarrollo y mapea el hostname en producción.
* **Autenticación Completa (`/auth`):**
  * Inicio de sesión con Hash bcrypt para contraseñas.
  * Tokens de corta duración (Access JWT) y tokens rotativos (Refresh tokens) de larga duración almacenados de forma segura en base de datos.
  * Sesiones revocables por dispositivo.
* **Bootstrap del Sistema (`/app/bootstrap`):**
  * Endpoint inteligente que devuelve datos del usuario logueado, información de su Tenant, membresía, permisos (RBAC) y un resumen de estadísticas dependiendo del rol (Admin, Profesor, Acudiente).
* **Módulos Core Académicos (Base de Datos & API):**
  * **Grupos (`/groups`):** CRUD funcional con validación Zod y scope por tenant.
  * **Estudiantes (`/students`):** Creación y edición con vinculación a grupos, acudientes y validación estricta de documentos duplicados dentro del mismo tenant.
  * **Docentes (`/teachers`):** CRUD básico y asignación de perfil académico.
  * **Acudientes (`/guardians`):** CRUD básico y relación de tutoría familiar.
  * **Auditoría (`/audit`):** Interceptor y servicio funcional que registra automáticamente acciones sensibles (`student.created`, `tenant.updated`, etc.) con valores anteriores y nuevos (old/new JSONB).

### Frontend (Next.js)
* **Auth & Protecciones:** Rutas protegidas mediante Middleware de Next.js (`/recuperar-password`, `/login`, `/registro`). Redirección automática según el rol (ej: `SUPER_ADMIN` a `/superadmin`).
* **Panel de SuperAdmin (`/superadmin`):**
  * Maquetación visual completa con Tailwind CSS y Lucide Icons (Dashboard general, métricas globales de colegios y uso, panel lateral).
  * Consumo de los endpoints `/tenants` y `/audit/logs?limit=6` con estados de carga (loading) y fallbacks controlados cuando la API está offline o lenta.
* **Mapeo de Rutas del Portal:** Estructura de carpetas básica para los paneles de administración escolar (`/admin/...`) y profesorado (`/profesor/...`).

---

## 3. Módulos y Tareas Pendientes ("Qué falta")

Para pasar de prototipo a una primera versión piloto lista para producción, se requiere complementar la funcionalidad visual del front y expandir el motor académico en la API.

### Backend (API)
1. **Falta Módulo de Materias y Horarios:** Crear endpoints de CRUD para `Subject` y `Schedule` (crucial para que los profesores consulten su agenda).
2. **Falta Asistencia (`/attendance`):** Tomar y registrar asistencia diaria o por horas, vinculando `AttendanceSession` y `AttendanceRecord`.
3. **Falta Calificaciones (`/marks`):** Crear categorías, registrar notas individuales de estudiantes por materia, y promediar periodos.
4. **Falta Tareas (`/homework`):** Carga de enunciados por el profesor y envío de evidencias por los estudiantes.
5. **Falta Comunicados y Mensajes (`/announcements`, `/messages`):** Módulo de cartelera digital escolar y chat asíncrono.
6. **Módulo de Archivos (`/files`):** Configurar el cliente de almacenamiento compatible con Cloudflare R2 / AWS S3 para PDFs, fotos y boletines.
7. **Rate Limiting:** Añadir protección mediante `nestjs-throttler` en rutas críticas (ej. `/auth/login`).

### Frontend (Web)
1. **Subrutas de SuperAdmin Reales:** Actualmente, `/superadmin/tenants` o `/superadmin/users` no existen físicamente. Al hacer clic en el menú, muestra un aviso de "Sección no disponible".
2. **CRUD Visual de Colegios:** Construir los formularios visuales en `/superadmin/tenants` para crear un tenant (ej. Colegio San José), asignarle dominio, cambiar branding y suspenderlo.
3. **Portal del Colegio (`/admin`):** Implementar la UI para cargar estudiantes y profesores en masa (CSV/Excel) y configurar los periodos del año lectivo.
4. **Portal del Docente (`/profesor`):** Conectar la UI con la API para registrar asistencia de forma rápida y calificar tareas.

### Mobile App (React Native / Expo)
* **Inicialización:** Levantar el proyecto base en `apps/mobile`.
* **Pantallas de Familia y Estudiantes:** Consulta visual de notas, registro de asistencia y notificaciones push.

---

## 4. Hoja de Ruta Sugerida para Continuar

Considerando la estrategia comercial para Sudamérica y la necesidad de tener un piloto rápido, se plantea la siguiente hoja de ruta en 3 etapas:

### Etapa 1: SuperAdmin Estable (Actual)
* Crear la página `/superadmin/tenants` para ver listados reales y habilitar la creación/edición de colegios.
* Reemplazar los datos mock en el Dashboard por endpoints reales de estadísticas.
* Validar que la creación de un Tenant inicial funcione de punta a punta.

### Etapa 2: Módulos Críticos Escolares (Operación Base)
* **Materias y Horarios:** Mapear en NestJS la creación de `Subject` y `Schedule`.
* **Carga Masiva:** Habilitar el importador de estudiantes y profesores por CSV/Excel.
* **Archivos:** Implementar subida y URLs firmadas con Cloudflare R2.

### Etapa 3: Gestión Diaria e Integración Móvil
* **Asistencia y Notas:** Flujo completo de toma de asistencia por docente y visualización en la app.
* **Mensajería Escolar:** Cartelera de comunicados y notificaciones push.
* **Inicializar App Móvil:** Crear el workspace `apps/mobile` con Expo.
