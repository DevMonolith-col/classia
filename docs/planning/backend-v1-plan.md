# Classia SaaS — Planeación Backend v1 para Codex

## Estado actual al 2026-05-26

Backend v1 ya no esta solo en fase de arranque. La base NestJS esta implementada y validada con e2e.

Rama actual de continuidad:

```txt
codex/backend-v1-continue
```

Estado implementado:

- `apps/api` con NestJS modular.
- Docker Compose con PostgreSQL y Redis.
- Prisma en `packages/database`.
- Schema base con `Tenant`, `User`, `TenantMembership`, `AuthSession` y `AuditLog`.
- Seed demo con superadmin, tenant admin, profesor y acudiente/familia.
- Healthcheck real con PostgreSQL y Redis.
- Auth JWT + refresh tokens + sesiones revocables.
- Resolucion de tenant por `x-tenant-slug` en desarrollo y hostname/dominio para produccion.
- Guards de JWT, tenant y permisos.
- CRUD base de tenants, users y memberships.
- Auditoria base para login, refresh, logout, tenants, users y memberships.
- Consulta de audit logs tenant-scoped.
- Errores globales normalizados con `path`, `timestamp` y detalles Zod.
- E2E backend para auth, tenant y auditoria.
- Puertos documentados restaurados: web `3000`, API `3001`.

Documentacion relacionada:

- Contrato para front: [`docs/api/frontend-contract.md`](../api/frontend-contract.md)
- E2E backend: [`docs/testing/backend-e2e.md`](../testing/backend-e2e.md)

Estado pendiente:

- Modulos academicos reales: estudiantes, profesores como entidad academica, acudientes, cursos/grupos, materias, horarios, asistencia, calificaciones, tareas y comunicados.
- Paginacion/filtros completos para tenants/users.
- Recuperacion de password, invitaciones y registro publico.
- Rate limiting de login.
- Swagger/OpenAPI o generacion formal de cliente.
- Storage S3/R2 real.
- Email/notificaciones.
- Jobs reales en BullMQ.

Decision vigente: no implementar modulos academicos hasta aprobar el primer dominio y su contrato multi-tenant.

---

## Propósito del documento

Este documento define la planeacion inicial y el estado actual del backend de Classia SaaS. La rama original fue `dev/backend-v1`; la continuidad de trabajo vive actualmente en `codex/backend-v1-continue`.

La intención es construir un backend propio, profesional y mantenible, evitando depender de un backend externo tipo BaaS como núcleo principal. Classia manejará lógica compleja de negocio, multi-tenancy, seguridad, auditoría, roles, reportes, notificaciones e integraciones; por eso el backend debe diseñarse desde el inicio como una pieza central del producto.

---

## Contexto del producto

Classia SaaS es una plataforma escolar multi-tenant para varios colegios.

No es una aplicación para un solo colegio.

Cada colegio debe operar como un tenant independiente, con:

- Usuarios propios.
- Estudiantes propios.
- Padres/acudientes propios.
- Profesores propios.
- Administrativos propios.
- Grados, grupos, materias y horarios propios.
- Asistencia y calificaciones propias.
- Comunicados propios.
- Reportes propios.
- Archivos propios.
- Configuración propia.
- Branding propio.
- Subdominio propio.

El backend debe proteger de forma estricta la separación de datos entre colegios.

---

## Decisión técnica principal

Para Classia se usará backend propio.

Stack aprobado:

```txt
Backend: NestJS + TypeScript
Base de datos: PostgreSQL
ORM: Prisma
Cache / colas: Redis + BullMQ
Storage: S3/R2 compatible
Auth: JWT + refresh tokens + sesiones
Arquitectura: monolito modular multi-tenant
Deploy: Docker
Package manager: pnpm
Monorepo: apps/api + packages/database + packages/shared + packages/validators
```

---

## Enfoque arquitectónico

El backend debe iniciar como un **monolito modular**, no como microservicios.

Esto significa:

- Una sola API principal.
- Módulos separados por dominio.
- Lógica organizada.
- Base de datos compartida.
- Workers separados cuando sea necesario.
- Código fácil de mantener por un equipo pequeño.
- Posibilidad futura de separar módulos si el producto crece.

No implementar microservicios, Kubernetes ni arquitectura distribuida compleja en esta versión.

---

## Objetivo de Backend v1

La rama `dev/backend-v1` debe dejar lista la base profesional del backend.

Al finalizar esta fase debia existir:

- App NestJS creada en `apps/api`.
- Docker Compose con PostgreSQL y Redis.
- Prisma configurado en `packages/database`.
- Schema inicial con modelos base.
- Configuración de variables de entorno.
- Healthcheck.
- Estructura modular.
- Tenants base.
- Users base.
- TenantMembership base.
- AuditLog base.
- Seed demo inicial.
- Scripts pnpm funcionales.
- Typecheck pasando.

Estado: esos puntos base ya estan implementados. Ademas se agregaron auth real con sesiones, CRUD base de administracion, auditoria consultable, e2e backend y contrato para front.

No se deben implementar todavia modulos academicos completos como estudiantes, acudientes, notas, asistencia o tareas sin aprobacion del siguiente dominio. Primero se estabiliza el cimiento.

---

## Orden de implementación recomendado

### 1. Crear app NestJS

Crear la aplicación backend dentro de:

```txt
apps/api
```

Debe ser una app NestJS con TypeScript.

Debe integrarse al monorepo pnpm.

Scripts esperados en `apps/api/package.json`:

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  }
}
```

El script raíz ya contempla:

```bash
pnpm dev:api
```

---

### 2. Crear Docker Compose local

Crear archivo:

```txt
docker-compose.yml
```

en la raíz del repo.

Debe incluir:

- PostgreSQL.
- Redis.

Configuración sugerida:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: classia-postgres
    environment:
      POSTGRES_USER: classia
      POSTGRES_PASSWORD: classia
      POSTGRES_DB: classia_saas
    ports:
      - "5432:5432"
    volumes:
      - classia_postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: classia-redis
    ports:
      - "6379:6379"

volumes:
  classia_postgres_data:
```

Comandos esperados:

```bash
docker compose up -d
docker compose ps
docker compose logs -f
docker compose down
```

---

### 3. Configurar Prisma en `packages/database`

El paquete `packages/database` debe contener:

```txt
packages/database/
├── package.json
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

El `schema.prisma` debe usar PostgreSQL.

Debe leer:

```env
DATABASE_URL="postgresql://classia:classia@localhost:5432/classia_saas?schema=public"
```

---

### 4. Crear schema inicial multi-tenant

Modelos mínimos para Backend v1:

```txt
Tenant
User
TenantMembership
AuditLog
```

También se pueden incluir enums base.

#### Tenant

Debe representar un colegio o institución.

Campos sugeridos:

```txt
id
name
slug
primaryDomain
status
logoUrl
brandColor
createdAt
updatedAt
```

Estados sugeridos:

```txt
ACTIVE
SUSPENDED
DEMO
PILOT
ARCHIVED
```

#### User

Debe representar una cuenta global.

Recomendación: usar usuario global + memberships por tenant.

Campos sugeridos:

```txt
id
email
passwordHash
firstName
lastName
status
createdAt
updatedAt
```

El email puede ser único globalmente para simplificar la autenticación.

Estados sugeridos:

```txt
ACTIVE
SUSPENDED
INVITED
DISABLED
```

#### TenantMembership

Debe representar la relación de un usuario con un colegio.

Campos sugeridos:

```txt
id
tenantId
userId
role
status
createdAt
updatedAt
```

Roles sugeridos:

```txt
SUPER_ADMIN
TENANT_ADMIN
PRINCIPAL
COORDINATOR
SECRETARY
TEACHER
GUARDIAN
STUDENT
SUPPORT_AGENT
```

Nota: `SUPER_ADMIN` podría manejarse fuera de tenant o con membresía especial. Para Backend v1 se puede incluir el rol en enum, pero se debe tener cuidado con permisos globales.

#### AuditLog

Debe registrar acciones sensibles.

Campos sugeridos:

```txt
id
tenantId
userId
action
entityType
entityId
oldValues
newValues
ipAddress
userAgent
createdAt
```

`tenantId` y `userId` pueden ser opcionales para soportar acciones globales o fallos de auth.

---

## Ejemplo conceptual de Prisma

Este ejemplo puede ajustarse durante la implementación.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  DEMO
  PILOT
  ARCHIVED
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  INVITED
  DISABLED
}

enum MembershipStatus {
  ACTIVE
  SUSPENDED
  INVITED
  DISABLED
}

enum UserRole {
  SUPER_ADMIN
  TENANT_ADMIN
  PRINCIPAL
  COORDINATOR
  SECRETARY
  TEACHER
  GUARDIAN
  STUDENT
  SUPPORT_AGENT
}

model Tenant {
  id            String       @id @default(cuid())
  name          String
  slug          String       @unique
  primaryDomain String?
  status        TenantStatus @default(ACTIVE)
  logoUrl       String?
  brandColor    String?

  memberships   TenantMembership[]
  auditLogs     AuditLog[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([slug])
  @@index([status])
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  firstName    String
  lastName     String
  status       UserStatus @default(ACTIVE)

  memberships  TenantMembership[]
  auditLogs    AuditLog[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([email])
  @@index([status])
}

model TenantMembership {
  id        String           @id @default(cuid())
  tenantId  String
  userId    String
  role      UserRole
  status    MembershipStatus @default(ACTIVE)

  tenant    Tenant @relation(fields: [tenantId], references: [id])
  user      User   @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, userId])
  @@index([tenantId])
  @@index([userId])
  @@index([tenantId, role])
}

model AuditLog {
  id         String  @id @default(cuid())
  tenantId   String?
  userId     String?

  action     String
  entityType String?
  entityId   String?

  oldValues  Json?
  newValues  Json?

  ipAddress  String?
  userAgent  String?

  tenant     Tenant? @relation(fields: [tenantId], references: [id])
  user       User?   @relation(fields: [userId], references: [id])

  createdAt  DateTime @default(now())

  @@index([tenantId])
  @@index([userId])
  @@index([action])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

---

## Resolución de tenant

El backend debe estar diseñado para resolver tenant desde el hostname.

Formato deseado en producción:

```txt
app.colegio.classia.com.co
```

Ejemplo:

```txt
app.sanpedro.classia.com.co
```

Debe resolverse como:

```txt
tenantSlug = sanpedro
```

En desarrollo debe poder usarse:

```txt
x-tenant-slug: demo
```

o un tenant demo por defecto.

Orden sugerido de resolución:

1. Si existe header `x-tenant-slug`, usarlo solo en desarrollo o entornos permitidos.
2. Si existe hostname tipo `app.{tenant}.classia.com.co`, extraer el tenant.
3. Buscar el tenant en base de datos por `slug` o `primaryDomain`.
4. Validar que el tenant exista y esté activo.
5. Adjuntar tenant al request context.

---

## Estructura esperada en `apps/api`

```txt
apps/api/src/
├── main.ts
├── app.module.ts
├── config/
│   ├── env.schema.ts
│   ├── app.config.ts
│   ├── database.config.ts
│   └── redis.config.ts
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── current-tenant.decorator.ts
│   │   └── permissions.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── tenant.guard.ts
│   │   └── permissions.guard.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── pipes/
│   │   └── zod-validation.pipe.ts
│   └── utils/
├── core/
│   ├── prisma/
│   ├── redis/
│   ├── queue/
│   ├── audit/
│   └── tenant-context/
├── modules/
│   ├── health/
│   ├── tenants/
│   ├── auth/
│   ├── users/
│   └── audit/
└── jobs/
```

Para Backend v1, se pueden crear carpetas base aunque algunas queden con implementación mínima.

---

## Configuración y variables de entorno

El backend debe validar variables de entorno.

Variables mínimas:

```env
NODE_ENV=development
PORT=3001
APP_DOMAIN=classia.com.co
DATABASE_URL=postgresql://classia:classia@localhost:5432/classia_saas?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
REFRESH_TOKEN_SECRET=change-me-too
```

Se debe mantener `.env.example` actualizado.

No subir `.env`.

Nota actual: `docker-compose.yml` expone PostgreSQL en `localhost:5432`. Si una maquina ya tiene Postgres local en ese puerto, se puede cambiar el mapping de Docker y sobreescribir `DATABASE_URL` en `.env`, sin modificar secretos ni defaults compartidos.

---

## Seguridad mínima desde Backend v1

Backend v1 debe preparar la base para:

- Validación de env.
- Helmet.
- CORS controlado.
- Errores globales controlados.
- No exponer stack traces fuera de `NODE_ENV=development`.
- Hash de contraseñas con bcrypt.
- Auth con access token y refresh token.
- Rate limiting futuro para login.
- Guards por tenant y permisos.
- Auditoría de acciones sensibles.

Estado actual: auth ya esta implementado para login, refresh, logout y `/auth/me`; rate limiting queda pendiente.

---

## Auditoría desde el inicio

El backend debe incluir `AuditLog` en el schema inicial.

Acciones futuras a registrar:

```txt
auth.login
auth.logout
tenant.created
tenant.updated
user.created
user.updated
membership.created
membership.updated
student.created
student.updated
attendance.created
attendance.updated
mark.created
mark.updated
announcement.sent
announcement.read
support.impersonation_started
support.impersonation_ended
```

Estado actual: el servicio base de auditoria ya existe y registra login, refresh, logout, tenants, users y memberships. `GET /audit/logs` permite consultar logs con alcance por tenant y permisos.

---

## Seeds demo

Crear seed demo inicial con:

- Tenant demo.
- Usuario superadmin.
- Usuario administrador del colegio demo.
- Usuario profesor demo.
- Usuario acudiente/familia demo.
- Memberships correspondientes.

Ejemplo de datos:

```txt
Tenant:
name: Colegio Demo Classia
slug: demo
primaryDomain: app.demo.classia.com.co
status: DEMO

Superadmin:
email: admin@classia.com.co

Tenant admin:
email: rector@demo.classia.com.co

Profesor:
email: lopez@demo.classia.co

Familia:
email: rosa@demo.classia.co
```

Las contraseñas deben ser claramente de desarrollo y documentadas en el seed, no usarse en producción.

---

## Scripts esperados

En la raíz:

```bash
pnpm dev:api
pnpm build
pnpm typecheck
pnpm lint
```

En database:

```bash
pnpm --filter @classia/database db:generate
pnpm --filter @classia/database db:migrate
pnpm --filter @classia/database db:studio
pnpm --filter @classia/database seed:demo
```

En Docker:

```bash
docker compose up -d
docker compose ps
docker compose logs -f
docker compose down
```

---

## Criterios de aceptación de Backend v1

La tarea base se considera lista cuando:

- [x] Existe `apps/api` como app NestJS funcional.
- [x] `pnpm dev:api` levanta el backend.
- [x] Existe `docker-compose.yml` con PostgreSQL y Redis.
- [x] PostgreSQL y Redis levantan correctamente.
- [x] Prisma esta configurado.
- [x] Existe schema inicial con `Tenant`, `User`, `TenantMembership`, `AuthSession` y `AuditLog`.
- [x] Se puede correr migracion inicial.
- [x] Se puede generar Prisma Client.
- [x] Existe seed demo.
- [x] Existe endpoint de healthcheck.
- [x] Existe estructura base para tenants.
- [x] Existe estructura base para users/memberships.
- [x] Existe estructura base para auditoria.
- [x] Auth JWT + refresh tokens funciona.
- [x] Errores globales estan normalizados.
- [x] E2E base de backend pasa.
- [x] `pnpm -r typecheck` pasa.
- [x] No se suben secretos.
- [x] No se implementan modulos academicos completos fuera del alcance inicial.

Criterios todavia pendientes para cerrar Backend v1 como contrato estable:

- [ ] Publicar/compartir contrato front-back y mantenerlo actualizado.
- [ ] Definir si se generara OpenAPI/Swagger o cliente tipado.
- [ ] Agregar paginacion/busqueda a listados admin si front lo requiere.
- [ ] Definir siguiente modulo academico y sus reglas multi-tenant antes de implementarlo.

---

## Lo que NO debe hacer Codex en esta rama

No implementar todavia sin aprobacion explicita:

- Estudiantes.
- Acudientes.
- Profesores.
- Horarios.
- Asistencia.
- Calificaciones.
- Tareas.
- Comunicados.
- Notificaciones push.
- Pagos.
- Transporte.
- Biblioteca.
- Enfermería.
- Nómina.
- Chat complejo.
- IA.
- Biometría.
- Firma digital.

No crear microservicios.

No cambiar la estructura general del monorepo sin aprobación.

No mover paquetes ya creados sin justificarlo.

No guardar secretos reales.

Nota: el schema Prisma puede contener modelos academicos de preparacion por merges previos, pero Backend v1 no debe exponer modulos/API academicos reales hasta aprobar alcance y pruebas multi-tenant.

---

## Siguiente orden recomendado

1. Alinear front con `docs/api/frontend-contract.md`.
2. Probar login real y redireccion por rol desde el front.
3. Integrar `/auth/me`, `/users/me` y `/users/me/memberships`.
4. Consumir endpoints admin base solo en pantallas donde ya exista UI preparada.
5. Agregar paginacion/filtros si el front lo necesita para tenants/users.
6. Definir primer modulo academico real con contrato, modelo y e2e antes de escribir endpoints.

---

## Prompt sugerido para Codex

Puedes pasarle a Codex algo así:

```txt
Trabaja en la rama dev/backend-v1.

Lee AGENTS.md y docs/agents antes de modificar código.

Implementa la base del backend de Classia SaaS siguiendo docs/planning/backend-v1-plan.md.

Objetivo:
- Crear apps/api con NestJS.
- Crear docker-compose.yml con PostgreSQL y Redis.
- Configurar Prisma en packages/database.
- Crear schema inicial con Tenant, User, TenantMembership y AuditLog.
- Crear seed demo.
- Crear HealthModule.
- Preparar estructura base de config, common, core y modules.
- Mantener enfoque multi-tenant.
- No implementar módulos académicos todavía.

Al terminar:
- Ejecuta pnpm install si hace falta.
- Ejecuta pnpm -r typecheck.
- Indica comandos para migrar DB y levantar Docker.
- No hagas push sin confirmación.
```

---

## Comandos manuales esperados para esta rama

```bash
git checkout main
git pull
git checkout -b dev/backend-v1
```

Después de que Codex haga cambios:

```bash
pnpm install
docker compose up -d
pnpm --filter @classia/database db:generate
pnpm --filter @classia/database db:migrate
pnpm --filter @classia/database seed:demo
pnpm -r typecheck
git status
git add .
git commit -m "feat(api): initialize backend v1 foundation"
git push -u origin dev/backend-v1
```
