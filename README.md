# Classia SaaS

SaaS escolar multi-tenant para colegios.

## Stack

- Web: Next.js + TypeScript + Tailwind CSS
- API: NestJS + TypeScript
- Mobile: React Native + Expo
- Database: PostgreSQL + Prisma
- Jobs/cache: Redis + BullMQ
- Package manager: pnpm
- Infra local: Docker

## Estructura

```txt
apps/web
apps/api
apps/mobile
packages/shared
packages/validators
packages/database
docker
docs
```

## Principios

- Multi-tenant desde el día uno.
- Todas las entidades académicas deben incluir tenant_id.
- Resolver tenant por hostname/subdominio.
- No exponer datos entre colegios.
- App nativa incluida desde la primera versión profesional.
- Integración con correos institucionales, no reemplazo de correos.

## Desarrollo

```bash
pnpm install
pnpm dev
```
