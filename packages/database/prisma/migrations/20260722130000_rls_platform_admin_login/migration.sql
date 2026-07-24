-- Habilita el login del rol classia_platform_admin (creado sin LOGIN en
-- 20260722120000_rls_app_roles). Necesario para que la Fase 4 pueda
-- levantar el segundo PrismaClient de bypass real
-- (apps/api/src/core/prisma/platform-admin-prisma.service.ts).
--
-- Contraseña de desarrollo en claro, misma convención que classia/classia_app
-- (ver docker-compose.yml, POSTGRES_PASSWORD) -- este es un repo de
-- desarrollo, no producción. En un entorno real la contraseña se rota vía
-- ALTER ROLE fuera de git.
ALTER ROLE classia_platform_admin WITH LOGIN PASSWORD 'classia_platform_admin';
