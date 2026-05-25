# Classia SaaS

SaaS escolar multi-tenant para colegios latinoamericanos. Gestión de asistencia, notas, tareas, comunicación y más — en una sola plataforma extensible mediante plugins.

## Stack

| Capa | Tecnología |
|------|-----------|
| Web | Next.js 16 + React 19 + Tailwind CSS + shadcn/ui |
| API | NestJS 10 + TypeScript + Passport JWT |
| Mobile | React Native + Expo _(próximamente)_ |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL 16 |
| Cache / Jobs | Redis 7 + BullMQ |
| Package manager | pnpm (workspaces) |
| Infra local | Docker Compose |

## Estructura del monorepo

```
apps/
  web/        → Panel web (admin, docente, familia)
  api/        → REST API NestJS
  mobile/     → App móvil Expo (próximamente)
packages/
  database/   → Schema Prisma + migraciones + seed
  shared/     → Tipos y utilidades compartidas
  validators/ → Schemas de validación reutilizables
docs/         → Documentación técnica y funcional
```

## Inicio rápido

### 1. Requisitos previos

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker Desktop

### 2. Clonar e instalar

```bash
git clone <repo>
cd classia-saas
pnpm install
```

### 3. Variables de entorno

```bash
# La API lee apps/api/.env
cp apps/api/.env.example apps/api/.env

# La base de datos lee packages/database/.env
echo 'DATABASE_URL="postgresql://classia:classia@localhost:5433/classia_saas"' > packages/database/.env
```

> **Nota:** El puerto es `5433` para evitar conflicto con PostgreSQL local. Si no tienes Postgres instalado localmente puedes usar `5432` en ambos archivos y en `docker-compose.yml`.

### 4. Levantar infraestructura

```bash
docker-compose up -d
```

### 5. Base de datos

```bash
pnpm --filter @classia/database db:generate   # genera el cliente Prisma
pnpm --filter @classia/database db:migrate     # crea las tablas
pnpm --filter @classia/database seed:demo      # datos de prueba
```

### 6. Desarrollo

```bash
# En terminales separadas:
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

## Credenciales demo

Tenant: `demo` (query param `?tenant=demo` en login)

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@demo.classia.co | demo123 |
| Profesor | lopez@demo.classia.co | demo123 |
| Padre | rosa@demo.classia.co | demo123 |

## API — endpoints principales

```
POST /v1/auth/login?tenant=demo
GET  /v1/auth/me

GET  /v1/admin/dashboard
GET  /v1/admin/students
GET  /v1/admin/teachers
GET  /v1/admin/courses
GET  /v1/admin/messages
GET  /v1/admin/announcements

GET  /v1/teacher/dashboard
GET  /v1/teacher/schedule
GET  /v1/teacher/groups
GET  /v1/teacher/attendance
POST /v1/teacher/attendance
GET  /v1/teacher/homework
POST /v1/teacher/homework
GET  /v1/teacher/marks
POST /v1/teacher/marks

GET  /v1/guardian/dashboard
GET  /v1/guardian/children
GET  /v1/guardian/grades
GET  /v1/guardian/attendance
GET  /v1/guardian/homework
GET  /v1/guardian/messages
```

Todos los endpoints (excepto login) requieren `Authorization: Bearer <token>`.

## Arquitectura multi-tenant

Base de datos compartida con `tenantId` en cada entidad. El tenant se resuelve por `slug` en el login y se transporta en el JWT. Los guards de NestJS garantizan que ninguna query cruce fronteras entre colegios.

## Principios de diseño

- Multi-tenant desde el día uno — todas las entidades incluyen `tenantId`
- Monolito modular (no microservicios) — modular NestJS + BullMQ para jobs en segundo plano
- Plugin marketplace — arquitectura preparada para módulos opcionales por colegio
- Tipado end-to-end — TypeScript en web, API y mobile compartiendo tipos vía `packages/shared`
- Sin un DB por colegio — shared DB es el estándar de la industria para V1 SaaS
