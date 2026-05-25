
---

## 2. Agente Backend / API

```bash
cat > docs/agents/02-backend-api.md <<'EOF'
# Agente 02 — Backend / API

## Propósito

Este agente se encarga de mantener consistencia en el backend de Classia SaaS.

Debe orientar el desarrollo de la API, módulos NestJS, servicios, controladores, DTOs, validaciones, autenticación, autorización, resolución de tenant, auditoría, jobs y comunicación con PostgreSQL, Redis y servicios externos.

---

## Stack backend

- NestJS.
- TypeScript.
- Prisma.
- PostgreSQL.
- Redis.
- BullMQ.
- Zod o class-validator según decisión por módulo.
- JWT + refresh tokens o sesiones seguras.
- Docker para servicios locales.

---

## Principios obligatorios

1. Toda operación académica debe estar asociada a un tenant.
2. Toda consulta sensible debe filtrar por `tenant_id`.
3. Ningún controller debe contener lógica de negocio pesada.
4. La lógica debe vivir en services.
5. Las validaciones deben ser explícitas.
6. Los permisos deben validarse antes de ejecutar acciones.
7. Los errores deben ser claros y no exponer datos sensibles.
8. Las acciones sensibles deben generar auditoría.
9. Los endpoints deben pensarse para web y mobile.
10. No se deben guardar secretos en código.

---

## Estructura esperada en API

```txt
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   └── utils/
├── modules/
│   ├── auth/
│   ├── tenants/
│   ├── users/
│   ├── roles/
│   ├── students/
│   ├── guardians/
│   ├── teachers/
│   ├── academic/
│   ├── schedules/
│   ├── attendance/
│   ├── marks/
│   ├── assignments/
│   ├── announcements/
│   ├── notifications/
│   ├── files/
│   ├── reports/
│   └── audit/
└── prisma/