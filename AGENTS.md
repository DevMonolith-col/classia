# Instrucciones para agentes de código

## Contexto

Este proyecto es un SaaS escolar multi-tenant para varios colegios.

No es una app para un solo colegio.

Cada colegio es un tenant independiente con sus propios usuarios, estudiantes, acudientes, profesores, horarios, notas, asistencia, comunicados, archivos, configuración y branding.





## Stack

- Monorepo con pnpm workspaces.
- Web: Next.js + TypeScript + Tailwind.
- API: NestJS + TypeScript + Prisma + PostgreSQL.
- Mobile: React Native + Expo + TypeScript.
- Jobs/cache: Redis + BullMQ.
- Storage: S3/R2.
- Infra: Docker.

## Reglas obligatorias

1. Toda entidad académica debe estar asociada a tenant_id.
2. Toda consulta del backend debe filtrar por tenant_id cuando aplique.
3. No exponer datos entre tenants.
4. No guardar secretos en el repositorio.
5. No pedir contraseñas de correos institucionales.
6. Integraciones de correo deben usar OAuth, APIs oficiales, SMTP seguro o proveedor transaccional.
7. Mantener auditoría para acciones sensibles.
8. Usar validaciones compartidas con Zod cuando sea posible.
9. Mantener tipos compartidos entre API, web y mobile.
10. Evitar lógica duplicada entre web y mobile.

## Estructura esperada

```txt
apps/web      -> Next.js
apps/api      -> NestJS
apps/mobile   -> Expo
packages/database   -> Prisma schema/client
packages/shared     -> tipos y constantes
packages/validators -> esquemas Zod
packages/ui         -> componentes compartidos cuando aplique
docs                -> documentación técnica y funcional
docker              -> compose y scripts
```

## No implementar todavía sin aprobación

- Pagos.
- Transporte.
- Biblioteca.
- Enfermería.
- Nómina.
- Chat complejo tipo WhatsApp.
- IA.
- Biometría.
- Firma digital avanzada.

---

## Agentes especializados

Además de estas reglas generales, el proyecto cuenta con agentes especializados en `docs/agents/`.

Antes de trabajar en un área específica, revisar el documento correspondiente:

```txt
docs/agents/01-arquitecto-saas.md
docs/agents/02-backend-api.md
docs/agents/03-database-prisma.md
docs/agents/04-frontend-mobile.md
docs/agents/05-qa-seguridad.md
```