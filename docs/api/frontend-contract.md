# Contrato Frontend / Backend v1

Estado al 2026-05-26.

Este documento resume que puede consumir el front hoy, que headers requiere, que respuestas devuelve la API y que sigue pendiente. La API corre en `http://localhost:3001` y el front en `http://localhost:3000`.

## Resumen ejecutivo

Backend disponible:

- Healthcheck real con PostgreSQL y Redis.
- Resolucion de tenant por `x-tenant-slug` en desarrollo.
- Auth real con JWT access token, refresh token y sesiones revocables.
- Usuarios globales con memberships por tenant.
- CRUD base admin para tenants, users y memberships.
- Auditoria base para acciones sensibles y consulta tenant-scoped.
- Errores normalizados y validaciones Zod estructuradas.
- E2E de backend para auth, tenant y auditoria.

Backend pendiente:

- Modulos academicos reales: estudiantes, profesores como entidad academica, acudientes, cursos/grupos, materias, horarios, asistencia, calificaciones, tareas y comunicados.
- Paginacion/filtros completos en usuarios y tenants.
- Recuperacion de password.
- Rate limiting de login.
- Storage S3/R2 real.
- Notificaciones/email transaccional.
- Contrato OpenAPI/Swagger generado.

## Requisitos para consumir la API

Headers comunes:

```txt
content-type: application/json
authorization: Bearer <accessToken>
x-tenant-slug: demo
```

Notas:

- `authorization` aplica solo a endpoints protegidos.
- `x-tenant-slug` se usa en desarrollo para resolver el tenant. En produccion se resolvera por hostname/dominio.
- El tenant demo es `demo`.
- Los tokens access expiran en 15 minutos.
- Los refresh tokens expiran a 30 dias y se rotan en cada refresh.

## Credenciales demo

Estas credenciales salen de `pnpm --filter @classia/database seed:demo`.

| Rol | Email | Password | Uso actual |
| --- | --- | --- | --- |
| SUPER_ADMIN | admin@classia.com.co | ClassiaDemo2026! | Administracion global / tenants |
| TENANT_ADMIN | rector@demo.classia.com.co | ClassiaDemo2026! | Admin del colegio demo |
| TEACHER | lopez@demo.classia.co | ClassiaDemo2026! | Login real, vistas de profesor aun mock |
| GUARDIAN | rosa@demo.classia.co | ClassiaDemo2026! | Login real, vistas de familia aun mock |

Los e2e crean ademas usuarios tecnicos `*.e2e@classia.test`; no usarlos en UI de producto.

## Formato de error

Todos los errores pasan por el filtro global:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed.",
  "details": {
    "issues": [
      {
        "path": "password",
        "code": "too_small",
        "message": "String must contain at least 6 character(s)"
      }
    ]
  },
  "path": "/auth/login",
  "timestamp": "2026-05-26T00:00:00.000Z"
}
```

`details` aparece cuando hay informacion estructurada, por ejemplo Zod. `stack` solo se expone con `NODE_ENV=development`.

Mensajes relevantes actuales:

| Caso | Status | message |
| --- | --- | --- |
| Token ausente | 401 | Access token is required. |
| Token invalido | 401 | Invalid access token. |
| Credenciales invalidas | 401 | Invalid credentials. |
| Refresh token invalido/revocado | 401 | Invalid refresh token. |
| Permiso insuficiente | 403 | Insufficient permissions. |
| Tenant requerido | 401 | Tenant context is required. |
| Tenant inexistente/inactivo | 404 | Tenant not found. |
| Validacion Zod | 400 | Validation failed. |

## Auth

### POST `/auth/login`

Publico. Resuelve tenant por `tenantSlug` en body o por `x-tenant-slug`.

Request:

```json
{
  "email": "rector@demo.classia.com.co",
  "password": "ClassiaDemo2026!",
  "tenantSlug": "demo"
}
```

Validacion:

- `email`: email valido, se normaliza a minusculas.
- `password`: string entre 6 y 128 caracteres.
- `tenantSlug`: opcional, slug `[a-z0-9-]` de 3 a 50 caracteres.

Response `201`:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-refresh-token>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresAt": "2026-06-24T22:53:53.636Z",
  "user": {
    "id": "<user-id>",
    "email": "rector@demo.classia.com.co",
    "firstName": "Rector",
    "lastName": "Demo"
  },
  "tenant": {
    "id": "<tenant-id>",
    "slug": "demo",
    "name": "Colegio Demo Classia"
  },
  "membership": {
    "id": "<membership-id>",
    "role": "TENANT_ADMIN"
  }
}
```

Accion auditada: `auth.login`.

### GET `/auth/me`

Protegido.

Response `200`:

```json
{
  "user": {
    "id": "<user-id>",
    "email": "rector@demo.classia.com.co",
    "tenantId": "<tenant-id>",
    "tenantSlug": "demo",
    "membershipId": "<membership-id>",
    "role": "TENANT_ADMIN",
    "permissions": ["tenants:read", "tenants:update", "users:create"]
  }
}
```

Nota: `permissions` viene calculado por el guard a partir del rol. Para UI, usar `role` como fuente principal de navegacion y `permissions` para habilitar acciones puntuales.

### POST `/auth/refresh`

Publico con refresh token valido.

Request:

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

Response `201`: mismo shape de tokens que login, sin `user`, `tenant` ni `membership`.

Accion auditada: `auth.refresh`.

### POST `/auth/logout`

Publico con refresh token.

Request:

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

Response `201`:

```json
{
  "status": "ok"
}
```

Accion auditada si la sesion existia y no estaba revocada: `auth.logout`.

## Tenants

### GET `/tenants/current`

Publico con `x-tenant-slug` en desarrollo.

Response `200`:

```json
{
  "id": "<tenant-id>",
  "slug": "demo",
  "name": "Colegio Demo Classia"
}
```

### GET `/tenants`

Protegido. Permiso: `tenants:list`.

Roles actuales con permiso:

- `SUPER_ADMIN`
- `SUPPORT_AGENT`

Response `200`: array de tenants.

### POST `/tenants`

Protegido. Permiso: `tenants:create`. Solo `SUPER_ADMIN`.

Request:

```json
{
  "name": "Colegio Nuevo",
  "slug": "colegio-nuevo",
  "primaryDomain": "app.colegio-nuevo.classia.com.co",
  "status": "PILOT",
  "logoUrl": "https://example.com/logo.png",
  "brandColor": "#2563eb"
}
```

Campos opcionales: `primaryDomain`, `status`, `logoUrl`, `brandColor`.

Accion auditada: `tenant.created`.

### GET `/tenants/:id`

Protegido. Permiso: `tenants:read`.

Reglas:

- `SUPER_ADMIN` y `SUPPORT_AGENT` pueden leer tenants visibles globalmente.
- Usuarios de tenant solo pueden leer su tenant actual.

### PATCH `/tenants/:id`

Protegido. Permiso: `tenants:update`.

Request parcial:

```json
{
  "name": "Colegio Demo Classia",
  "primaryDomain": "app.demo.classia.com.co",
  "brandColor": "#2563eb"
}
```

Reglas:

- `SUPER_ADMIN` puede actualizar cualquier tenant y su `status`.
- `TENANT_ADMIN` puede actualizar su tenant, pero no `status`.

Accion auditada: `tenant.updated`.

## Users y memberships

Todos los endpoints de `/users` son protegidos y requieren permisos.

### GET `/users/me`

Permiso: `users:read:self`.

Response `200`:

```json
{
  "id": "<user-id>",
  "email": "rector@demo.classia.com.co",
  "firstName": "Rector",
  "lastName": "Demo",
  "status": "ACTIVE",
  "createdAt": "2026-05-26T00:00:00.000Z",
  "updatedAt": "2026-05-26T00:00:00.000Z"
}
```

### GET `/users/me/memberships`

Permiso: `users:read:memberships`.

Response `200`: array de memberships con tenant asociado.

### GET `/users?tenantId=<tenant-id>`

Permiso: `users:list`.

Reglas:

- `SUPER_ADMIN` y `SUPPORT_AGENT` pueden listar globalmente o filtrar por `tenantId`.
- Usuarios de tenant quedan limitados a su `tenantId`.

Pendiente: paginacion y busqueda.

### POST `/users`

Permiso: `users:create`.

Request:

```json
{
  "email": "usuario@demo.classia.co",
  "password": "ClassiaDemo2026!",
  "firstName": "Nombre",
  "lastName": "Apellido",
  "tenantId": "<tenant-id>",
  "role": "TEACHER",
  "status": "ACTIVE",
  "membershipStatus": "ACTIVE"
}
```

Notas:

- `password`: minimo 8 caracteres.
- Si `tenantId` no viene y el actor es tenant-scoped, se usa el tenant actual.
- El actor solo puede asignar roles permitidos por su propio rol.

Accion auditada: `user.created`.

### GET `/users/:id`

Permiso: `users:read`.

Reglas:

- Global admin/support: acceso global.
- Tenant-scoped: solo usuarios con membership en el tenant actual.

### PATCH `/users/:id`

Permiso: `users:update`.

Request parcial:

```json
{
  "firstName": "Nombre",
  "lastName": "Apellido",
  "status": "ACTIVE",
  "password": "NuevaClaveSegura"
}
```

Accion auditada: `user.updated`.

### POST `/users/:id/memberships`

Permiso: `memberships:create`.

Request:

```json
{
  "tenantId": "<tenant-id>",
  "role": "TEACHER",
  "status": "ACTIVE"
}
```

Accion auditada: `membership.created`.

### PATCH `/users/:id/memberships/:membershipId`

Permiso: `memberships:update`.

Request parcial:

```json
{
  "role": "TEACHER",
  "status": "ACTIVE"
}
```

Accion auditada: `membership.updated`.

## Auditoria

### GET `/audit/status`

Publico.

Response:

```json
{
  "status": "audit-module-ready"
}
```

### GET `/audit/logs`

Protegido. Permiso: `audit:read`.

Query params:

| Param | Tipo | Default | Nota |
| --- | --- | --- | --- |
| tenantId | string | actor tenant | Solo global/support puede consultar otros tenants |
| userId | string | - | Filtro por usuario |
| action | string | - | Ej. `auth.login` |
| entityType | string | - | Ej. `User` |
| entityId | string | - | Id de entidad |
| from | ISO datetime | - | Inicio |
| to | ISO datetime | - | Fin |
| limit | number | 50 | Min 1, max 100 |
| cursor | string | - | Cursor de paginacion |

Response `200`:

```json
{
  "items": [
    {
      "id": "<audit-id>",
      "tenantId": "<tenant-id>",
      "userId": "<user-id>",
      "actorRole": "TENANT_ADMIN",
      "action": "auth.login",
      "entityType": "User",
      "entityId": "<user-id>",
      "oldValues": null,
      "newValues": null,
      "ipAddress": "::1",
      "userAgent": "curl/8.0.0",
      "createdAt": "2026-05-26T00:00:00.000Z"
    }
  ],
  "pageInfo": {
    "hasNextPage": false
  }
}
```

Reglas:

- `TENANT_ADMIN` ve solo logs de su tenant.
- `SUPER_ADMIN` y `SUPPORT_AGENT` pueden consultar global o por tenant.
- `TEACHER`, `GUARDIAN` y `STUDENT` no tienen permiso.

## Roles y permisos actuales

| Rol | Puede usar hoy |
| --- | --- |
| SUPER_ADMIN | Tenants CRUD, users CRUD, memberships, audit |
| TENANT_ADMIN | Su tenant, users/memberships de su tenant, audit de su tenant |
| SUPPORT_AGENT | List/read tenants, self/memberships, audit |
| PRINCIPAL | Tenant read, self/memberships |
| COORDINATOR | Tenant read, self/memberships |
| SECRETARY | Tenant read, self/memberships |
| TEACHER | Self/memberships |
| GUARDIAN | Self/memberships |
| STUDENT | Self/memberships |

## Que puede probar front hoy

Funciona contra backend real:

- Login con credenciales demo.
- Guardar `accessToken` y `refreshToken`.
- Consumir `/auth/me`.
- Consumir `/users/me` y `/users/me/memberships`.
- Resolver tenant con `GET /tenants/current`.
- Admin: listar tenants con superadmin.
- Admin de tenant: consultar/actualizar su tenant.
- Admin de tenant: listar usuarios de su tenant.
- Admin de tenant: crear/actualizar usuarios y memberships.
- Admin de tenant: consultar audit logs tenant-scoped.
- Manejar errores con `statusCode`, `message`, `details.issues`, `path` y `timestamp`.

No funciona todavia como backend real:

- Dashboards academicos con datos reales.
- Listados reales de estudiantes/profesores/acudientes como entidades academicas.
- Asistencia, calificaciones, tareas, horarios, mensajes/comunicados.
- Registro publico, recuperar password y flujos de invitacion.
- Upload/download de archivos.
- Notificaciones push/email.

## Recomendaciones para integracion front

- Centralizar cliente HTTP con `APP_API_URL` apuntando a `http://localhost:3001`.
- En desarrollo enviar `x-tenant-slug: demo` en login y endpoints tenant-aware.
- Usar `role` de `/auth/me` o del login para redireccionar a `/admin`, `/profesor` o `/familia`.
- Tratar `401` como sesion expirada o token ausente; intentar refresh solo si existe refresh token.
- Tratar `403` como pantalla/accion no permitida.
- Mostrar `details.issues[]` para errores de formulario.
- No construir UI academica contra endpoints ficticios: mantener mock local hasta que el modulo exista.

## Verificacion rapida

```bash
pnpm --filter api test:e2e
pnpm -r typecheck
```

Smoke manual:

```bash
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "content-type: application/json" \
  -H "x-tenant-slug: demo" \
  -d '{"email":"rector@demo.classia.com.co","password":"ClassiaDemo2026!","tenantSlug":"demo"}' \
  | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).accessToken')

curl http://localhost:3001/auth/me \
  -H "authorization: Bearer $ACCESS_TOKEN"
```
