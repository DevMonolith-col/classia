# Backend E2E

Estas pruebas validan la base de Backend v1 usando la app NestJS real contra PostgreSQL y Redis locales.

## Requisitos

Antes de correrlas:

```bash
docker compose up -d
pnpm --filter @classia/database db:migrate
```

La suite prepara usuarios e2e dedicados dentro del tenant `demo`, por lo que no depende de que todos hayan re-ejecutado el seed mas reciente. Aun asi, para revisar manualmente la app conviene tener el seed demo:

```bash
pnpm --filter @classia/database seed:demo
```

## Comandos

```bash
pnpm --filter api test:e2e
```

Tambien se pueden correr desde la raiz junto con el resto de paquetes:

```bash
pnpm -r test
```

## Cobertura actual

La suite `apps/api/test/backend-v1.e2e-spec.ts` valida:

- `GET /health` responde con la API viva y conectada a PostgreSQL/Redis.
- `GET /tenants/current` resuelve el tenant `demo` usando `x-tenant-slug`.
- `POST /auth/login` autentica un tenant admin.
- `GET /auth/me` devuelve el contexto JWT actual.
- Login con credenciales invalidas devuelve `401`.
- Payload invalido devuelve `400`.
- Endpoint protegido sin token devuelve `401`.
- Los errores e2e no exponen `stack` y devuelven `path` + `timestamp`.
- Los errores de Zod devuelven `details.issues[]` con `path`, `code` y `message`.
- `POST /auth/refresh` rota tokens.
- `POST /auth/logout` revoca refresh tokens.
- `GET /audit/logs` responde solo a roles con permiso.
- Un tenant admin no puede forzar consulta de audit logs de otro tenant.
- Un profesor sin permiso recibe `403` en audit logs.

## Datos e2e

Los tests crean o actualizan estos usuarios tecnicos en el tenant `demo`:

| Rol | Email | Password |
| --- | --- | --- |
| Tenant admin | tenant-admin.e2e@classia.test | ClassiaDemo2026! |
| Profesor | teacher.e2e@classia.test | ClassiaDemo2026! |

Estos usuarios existen solo para pruebas locales y no deben usarse como datos de producto.

## Criterio de aceptacion

Antes de integrar cambios sobre auth, tenants, permisos o auditoria, correr:

```bash
pnpm --filter api test:e2e
pnpm -r typecheck
```

Si una prueba falla por contrato esperado, actualizar primero el documento de API/README y luego el test. Si falla por una regresion de seguridad multi-tenant, corregir el backend antes de continuar.
