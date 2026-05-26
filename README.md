# Classia SaaS

SaaS escolar multi-tenant para colegios. Esta rama integra el primer front navegable con la base backend v1: NestJS modular, Prisma/PostgreSQL, Redis, auth JWT, tenants, usuarios, memberships y auditoría básica.

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
docs                  Documentacion tecnica y funcional
```

## Inicio Rapido

```bash
pnpm install
docker compose up -d
pnpm --filter @classia/database db:generate
pnpm --filter @classia/database db:migrate
pnpm --filter @classia/database seed:demo
```

En terminales separadas:

```bash
pnpm dev:api
pnpm dev:web
```

URLs locales:

```txt
Web: http://localhost:3000
API: http://localhost:3001
```

La API carga variables desde `.env` si existe y usa `.env.example` como base de desarrollo. No subir `.env`.

## Credenciales

### API real

Estas credenciales salen del seed demo y funcionan contra `apps/api`.

| Rol | Tenant | Email | Password |
| --- | --- | --- | --- |
| Superadmin | demo | admin@classia.com.co | ClassiaDemo2026! |
| Tenant admin | demo | rector@demo.classia.com.co | ClassiaDemo2026! |
| Profesor | demo | lopez@demo.classia.co | ClassiaDemo2026! |
| Familia | demo | rosa@demo.classia.co | ClassiaDemo2026! |

Ejemplo:

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "content-type: application/json" \
  -H "x-tenant-slug: demo" \
  -d '{"email":"rector@demo.classia.com.co","password":"ClassiaDemo2026!"}'
```

### Front navegable

El front integrado todavia usa navegacion visual en login. En `http://localhost:3000/login` puedes usar los botones demo:

| Vista | Email mostrado | Password mostrado | Destino |
| --- | --- | --- | --- |
| Admin | admin@classia.com.co | ClassiaDemo2026! | `/admin` |
| Profesor | lopez@demo.classia.co | ClassiaDemo2026! | `/profesor` |
| Familia | rosa@demo.classia.co | ClassiaDemo2026! | `/familia` |

Los perfiles Profesor y Familia existen en el seed backend, pero sus modulos academicos todavia son vistas navegables sin datos reales.

## Vistas Para Revisar

```txt
/                         Landing
/login                    Login con accesos demo
/admin                    Dashboard admin
/admin/estudiantes        Estudiantes
/admin/profesores         Profesores
/admin/cursos             Cursos
/admin/asistencia         Asistencia admin
/admin/tareas             Tareas admin
/admin/mensajes           Mensajes admin
/admin/reportes           Reportes
/admin/configuracion      Configuracion
/admin/plugins            Plugins
/profesor                 Dashboard profesor
/profesor/asistencia      Asistencia profesor
/profesor/calificaciones  Calificaciones
/profesor/horario         Horario
/profesor/tareas          Tareas
/profesor/mensajes        Mensajes
/familia                  Dashboard familia
/familia/asistencia       Asistencia
/familia/calificaciones   Calificaciones
/familia/horario          Horario
/familia/tareas           Tareas
/familia/mensajes         Mensajes
/familia/incapacidades    Incapacidades
```

## API Actual

Base disponible en Backend v1:

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

Los endpoints protegidos requieren:

```txt
Authorization: Bearer <accessToken>
```

Para resolver tenant en desarrollo:

```txt
x-tenant-slug: demo
```

## Verificacion

```bash
pnpm -r typecheck
pnpm -r build
pnpm --filter api test:e2e
curl http://localhost:3001/health
curl -H x-tenant-slug:demo http://localhost:3001/tenants/current
```

Los e2e del backend requieren PostgreSQL y Redis locales. Ver [docs/testing/backend-e2e.md](docs/testing/backend-e2e.md).

Smoke de auth:

```bash
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "content-type: application/json" \
  -H "x-tenant-slug: demo" \
  -d '{"email":"rector@demo.classia.com.co","password":"ClassiaDemo2026!"}' \
  | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).accessToken')

curl http://localhost:3001/auth/me \
  -H "authorization: Bearer $ACCESS_TOKEN"
```

## Alcance Actual

Incluido:

- Base NestJS modular.
- Docker Compose con PostgreSQL y Redis.
- Prisma con Tenant, User, TenantMembership, AuthSession y AuditLog.
- Seed demo.
- Auth JWT + refresh tokens.
- Guards de tenant y permisos.
- CRUD admin base de tenants, users y memberships.
- Front navegable para landing, admin, profesor y familia.

No incluido todavia en backend:

- Estudiantes.
- Profesores como entidad academica.
- Acudientes.
- Asistencia real.
- Calificaciones.
- Tareas.
- Comunicados.
- Notificaciones.
- Pagos, transporte, biblioteca, enfermeria, nomina, IA, biometria o firma digital avanzada.
