# Migración a VPS autocontenida (decisión tomada, sin ejecutar)

> Estado: **idea/decisión registrada el 2026-07-19, nada provisionado todavía.**
> Este documento existe para no perder el contexto de la decisión hasta que se
> contrate la VPS y se retome. No es un plan de implementación detallado.

## Qué se decidió

El 2026-07-19, al preparar el merge de `feature/reportes-reales` a `main`, se decidió
**dejar de usar Railway por completo** y mover la infraestructura a una **VPS
autocontenida**. Motivo expresado por el usuario: mejor escalabilidad y mejores
precios que Railway.

Como parte de esa misma conversación:
- El proyecto de Railway `Classia-SaaS` (que contenía **ambos** environments,
  `production` y `shared-dev`, en el mismo proyecto) fue **eliminado por completo**
  el 2026-07-19. No había datos reales en ninguno de los dos (confirmado con el
  usuario antes de borrar) — arranque limpio, sin migración de datos pendiente.
- La rama `develop` (que Railway desplegaba a `shared-dev`) se eliminó también,
  local y remota. El repo pasó a un flujo de **rama única (`main`)**.
- Se agregó CI real por primera vez en el repo (`.github/workflows/ci.yml`):
  typecheck + suite completa de tests + build, en cada push/PR a `main`. Cuando
  se retome esta migración, ese mismo workflow es el lugar natural para agregar
  un job de `deploy`.

## Un detalle importante para el alcance: el frontend queda aparte

El usuario aclaró explícitamente que **el frontend (`apps/web`) sigue planificado
para vivir fuera de la VPS** (lectura más probable: algo tipo Vercel, dado que es
Next.js — no se confirmó el proveedor exacto). La VPS es para el resto:
- `apps/api` (NestJS)
- Postgres
- Redis
- Storage S3-compatible (MinIO en local; en la VPS podría seguir siendo MinIO
  autohospedado, o un proveedor S3 externo — no decidido)

Esto importa porque cambia el alcance de "autocontenido": no es "todo en un solo
lugar", es "todo el backend+datos en un solo lugar, el frontend server-rendered
sigue donde ya funciona bien para Next.js".

## Lo que ya está listo para esto (verificado, no hay que rehacerlo)

- **`apps/api/src/app.setup.ts`** ya tiene `trust proxy` habilitado y CORS dinámico
  por regex de subdominio (`tenantOriginRegex`) — implementado según
  [`backend-deployment-readiness.md`](backend-deployment-readiness.md), que en su
  momento apuntaba específicamente a un VPS de **Hostinger controlado por Coolify**.
  Esa referencia (Hostinger/Coolify) puede o no seguir siendo el proveedor elegido
  ahora — no se confirmó en esta conversación, es la pista más concreta que existe
  hasta hoy sobre cuál VPS/orquestador se tenía en mente.
- **`docker-compose.yml`** ya define Postgres 16 + Redis 7 + MinIO con volúmenes
  persistentes — es la base natural para lo que correría en la VPS (ajustando
  puertos/credenciales/TLS para producción, no para usarse tal cual).
- **CI** (`.github/workflows/ci.yml`, agregado el 2026-07-19) ya verifica que
  `pnpm build` funciona limpio para `apps/api` (`nest build`) y `apps/web`
  (`next build --webpack`) en cada push — la base para armar imágenes de
  producción ya está probada.

## Lo que falta decidir/hacer cuando se retome (sin empezar todavía)

- Contratar la VPS (proveedor sin confirmar — ver nota de Hostinger arriba).
- Elegir el orquestador/PaaS-en-VPS (Coolify era la referencia previa; podría
  seguir siendo esa u otra).
- Empaquetar `apps/api` para producción: hoy solo hay `nest build` (compila a
  `dist/`), falta un `Dockerfile` de producción (o el mecanismo que use el
  orquestador elegido) y decidir cómo se corre `prisma migrate deploy` en cada
  release.
- Definir dónde vive el storage S3-compatible en producción (MinIO autohospedado
  en la VPS vs. un proveedor externo tipo Cloudflare R2/Backblaze).
- Agregar el job de `deploy` al workflow de CI existente, una vez haya un target
  real al que desplegar.
- Definir el dominio/DNS de producción y cómo apunta al backend en la VPS
  (relevante para el CORS dinámico ya implementado, que espera subdominios de
  `APP_DOMAIN`).
