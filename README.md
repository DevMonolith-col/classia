# Classia SaaS

SaaS escolar multi-tenant para colegios. Este monorepo incluye web con Next.js, API con NestJS, Prisma/PostgreSQL, Redis y contratos compartidos.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Web | Next.js 16 + React 19 + Tailwind CSS + shadcn/ui |
| API | NestJS + TypeScript |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL 16 |
| Cache / Jobs | Redis 7 + BullMQ |
| Package manager | pnpm workspaces |
| Infra local | Docker Compose |

## Estructura

```txt
apps/web              Front Next.js
apps/api              API NestJS
apps/mobile           App Expo pendiente
packages/database     Prisma schema, migraciones y seed
packages/shared       Tipos y constantes compartidas
packages/validators   Schemas Zod compartidos
docs                  Documentacion tecnica y operativa
```

## Estado actual

- `main` ya puede correr `apps/web` contra el backend compartido en Railway.
- No es obligatorio levantar backend local para cambios de frontend.
- Backend local sigue siendo recomendable para cambios profundos de `apps/api`, Prisma, migraciones o debugging serio.

Backend compartido actual:

```txt
API: https://classia-api-production-fd89.up.railway.app
Health: https://classia-api-production-fd89.up.railway.app/health
```

## Inicio rapido local

Instalacion base:

```bash
pnpm install
docker compose up -d
pnpm --filter @classia/database db:generate
pnpm --filter @classia/database db:migrate
pnpm --filter @classia/database seed:demo
```

Desarrollo completo local:

```bash
pnpm dev:api
pnpm dev:web
```

Solo frontend contra Railway:

```bash
pnpm --filter @classia/web dev
```

`pnpm install` ejecuta `postinstall` y regenera Prisma automaticamente.

`pnpm dev:api` y `pnpm dev` liberan primero el puerto `3001` si quedo ocupado por un proceso de este workspace. Si tambien necesitas limpiar puertos manualmente:

```bash
pnpm ports:free
pnpm ports:free:force
```

URLs locales:

```txt
Web: http://localhost:3000
API: http://localhost:3001
Postgres: localhost:5432
Redis: localhost:6379
```

## Variables de entorno

La API carga variables desde `.env` si existe y usa `.env.example` como base de desarrollo. No subir `.env`.

Variables clave:

```txt
NEXT_PUBLIC_API_URL      URL base consumida por apps/web
NEXT_PUBLIC_TENANT_SLUG  Tenant por defecto en desarrollo
APP_WEB_URL              Origen principal permitido por la API
APP_CORS_ORIGINS         Lista separada por comas para CORS
DATABASE_URL             Conexion de PostgreSQL
REDIS_URL                Conexion de Redis
JWT_SECRET               Secreto del access token
REFRESH_TOKEN_SECRET     Secreto del refresh token
```

`JWT_SECRET` y `REFRESH_TOKEN_SECRET` son solo del backend. No van en el frontend.

## Flujos de trabajo

- Front local contra Railway: ver [docs/operations/frontend-with-railway.md](docs/operations/frontend-with-railway.md)
- Backend local completo: usar `.env` local, Docker y `pnpm dev:api`
- Railway production: `main` despliega el backend compartido

## Credenciales demo

Estas credenciales salen del seed demo y funcionan tanto en local como en Railway si ya corriste migraciones y `seed:demo`.

| Rol | Tenant | Email | Password |
| --- | --- | --- | --- |
| Superadmin | demo | admin@classia.com.co | ClassiaDemo2026! |
| Tenant admin | demo | rector@demo.classia.com.co | ClassiaDemo2026! |
| Profesor | demo | lopez@demo.classia.co | ClassiaDemo2026! |
| Familia | demo | rosa@demo.classia.co | ClassiaDemo2026! |

Ejemplo de login por API:

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "content-type: application/json" \
  -H "x-tenant-slug: demo" \
  -d '{"email":"rector@demo.classia.com.co","password":"ClassiaDemo2026!"}'
```

## Seed demo

`pnpm --filter @classia/database seed:demo` es mayormente idempotente:

- tenant, usuarios y memberships usan `upsert`
- si cambias nombres, roles o password demo, la corrida vuelve a dejarlos en ese estado
- cada corrida agrega un `auditLog` nuevo de tipo `seed.demo_created`

Eso significa que puedes correr el seed otra vez para refrescar usuarios demo, pero no debes tratarlo como una migracion de datos productivos.

## API actual

Base disponible en backend v1:

```txt
GET  /health
GET  /tenants/current
GET  /tenants
POST /tenants
GET  /tenants/:id
PATCH /tenants/:id

POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me

GET  /users/me
GET  /users/me/memberships
GET  /users
POST /users
GET  /users/:id
PATCH /users/:id
POST /users/:id/memberships
PATCH /users/:id/memberships/:membershipId

GET  /audit/status
GET  /audit/logs
```

Contrato detallado para front: [docs/api/frontend-contract.md](docs/api/frontend-contract.md)

Los endpoints protegidos requieren:

```txt
Authorization: Bearer <accessToken>
```

En desarrollo y demo actual:

```txt
x-tenant-slug: demo
```

## Verificacion

```bash
pnpm -r build
pnpm --filter @classia/database db:generate
pnpm --filter api test:e2e
curl http://localhost:3001/health
curl -H x-tenant-slug:demo http://localhost:3001/tenants/current
```

Los e2e del backend requieren PostgreSQL y Redis locales. Ver [docs/testing/backend-e2e.md](docs/testing/backend-e2e.md).

## Alcance actual

Incluido:

- Base NestJS modular
- Docker Compose con PostgreSQL y Redis
- Prisma con Tenant, User, TenantMembership, AuthSession y AuditLog
- Seed demo
- Auth JWT + refresh tokens
- Guards de tenant y permisos
- CRUD admin base de tenants, users y memberships
- Front navegable para landing, admin, profesor y familia

No incluido todavia en backend:

- Estudiantes
- Profesores como entidad academica
- Acudientes
- Asistencia real
- Calificaciones
- Tareas
- Comunicados
- Notificaciones
- Pagos, transporte, biblioteca, enfermeria, nomina, IA, biometria o firma digital avanzada
