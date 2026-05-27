# Front Local Con Railway

Esta guia describe el flujo recomendado actual para trabajar frontend en `main` sin levantar backend local.

## Objetivo

Usar:

```txt
Front local: http://localhost:3000
Backend compartido: https://classia-api-production-fd89.up.railway.app
```

Con este flujo:

- frontend y QA no dependen de que alguien tenga `apps/api` levantada
- el equipo comparte el mismo backend demo
- backend local queda reservado para cambios profundos de API o Prisma

## Estrategia de ramas y environments

Convencion recomendada:

```txt
main     -> Railway production
develop  -> Railway shared-dev o staging
feature/* y fix/* -> ramas cortas de trabajo
```

Notas:

- Railway conecta environments a ramas de GitHub, no crea ramas propias
- `develop` debe tener su propio `Postgres` y `Redis`
- el frontend local puede cambiar entre production y shared-dev ajustando `NEXT_PUBLIC_API_URL`

## Configuracion del frontend local

Crea `apps/web/.env.local` con:

```txt
NEXT_PUBLIC_API_URL=https://classia-api-production-fd89.up.railway.app
NEXT_PUBLIC_TENANT_SLUG=demo
```

Luego levanta solo el frontend:

```bash
pnpm --filter @classia/web dev
```

## Configuracion minima en Railway API

En el servicio `Classia Api`, variables requeridas:

```txt
APP_API_URL=https://classia-api-production-fd89.up.railway.app
APP_WEB_URL=http://localhost:3000
APP_CORS_ORIGINS=http://localhost:3000
NODE_ENV=production
JWT_SECRET=<secreto backend>
REFRESH_TOKEN_SECRET=<secreto backend>
DATABASE_URL=<referencia interna a Postgres Railway>
REDIS_URL=<referencia interna a Redis Railway>
```

Notas:

- `APP_WEB_URL` y `APP_CORS_ORIGINS` son los que habilitan CORS para el front local
- `JWT_SECRET` y `REFRESH_TOKEN_SECRET` no van en el frontend
- `DATABASE_URL` interna de Railway sirve dentro de Railway, no desde tu PC local

## Preparacion de la base en Railway

Si la base de Railway esta vacia, desde tu maquina local debes usar la URL publica del servicio `Postgres`, no la interna `railway.internal`.

Aplicar migraciones:

```powershell
$env:DATABASE_URL="postgresql://<user>:<password>@<host-publico>:<port>/railway"
pnpm --filter @classia/database prisma migrate deploy
```

Cargar seed demo:

```powershell
$env:DATABASE_URL="postgresql://<user>:<password>@<host-publico>:<port>/railway"
pnpm --filter @classia/database seed:demo
```

## Validaciones utiles

Healthcheck:

```powershell
curl.exe -i https://classia-api-production-fd89.up.railway.app/health -H "Origin: http://localhost:3000"
```

Debe incluir:

```txt
Access-Control-Allow-Origin: http://localhost:3000
```

Credenciales demo:

```txt
admin@classia.com.co / ClassiaDemo2026!
rector@demo.classia.com.co / ClassiaDemo2026!
lopez@demo.classia.co / ClassiaDemo2026!
rosa@demo.classia.co / ClassiaDemo2026!
```

## Cuando si levantar backend local

Levanta `apps/api` local solo cuando necesites:

- cambiar codigo de backend
- probar migraciones Prisma antes de Railway
- depurar auth, guards o queries a bajo nivel
- trabajar sin depender del estado compartido de Railway
