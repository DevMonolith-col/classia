-- Fase 2 (continuacion) de docs/planning/aislamiento-rls-multitenant.md,
-- trampa #7: "classia" (el rol con el que corren las migraciones y, hasta
-- ahora, tambien la app en runtime) es SUPERUSER de Postgres -- es el
-- usuario de bootstrap de la imagen oficial de postgres (ver
-- POSTGRES_USER en docker-compose.yml). Un superuser SIEMPRE ignora Row
-- Level Security, sin excepcion -- ni siquiera FORCE ROW LEVEL SECURITY lo
-- cambia. Verificado en vivo el 2026-07-22 contra una tabla de prueba: con
-- "classia" (superuser), FORCE RLS sin ningun app.tenant_id seteado igual
-- devolvio todas las filas de todos los tenants (RLS no aplicaba, no
-- importaba lo que dijera la politica); con "classia_app" (no superuser,
-- este rol), sin contexto devolvio cero filas y con SET LOCAL solo las del
-- tenant correcto.
--
-- Esta migracion es segura de aplicar YA (crear un rol y otorgarle permisos
-- no rompe nada en produccion): son las Fases 2 (ENABLE+FORCE+POLICY, en
-- 20260722110000_rls_enable_force_policies) y 4 (extension de Prisma) las
-- que deben esperar a estar completas juntas.
--
-- A partir de que la Fase 4 este lista, la app en runtime DEBE conectarse
-- con DATABASE_URL_APP (rol classia_app), NO con DATABASE_URL (rol
-- classia, que sigue siendo el dueno de las tablas y el que corre
-- `prisma migrate` -- las migraciones SI necesitan ser superuser/dueno para
-- poder hacer ALTER TABLE, CREATE POLICY, etc).

-- Rol de runtime de la app: sin privilegios de superuser, sin BYPASSRLS --
-- es el que hace que RLS aplique de verdad. La contraseña de desarrollo
-- acá sigue la misma convención que POSTGRES_PASSWORD en docker-compose.yml
-- (repo de desarrollo, no producción); en un entorno real se rota vía
-- ALTER ROLE fuera de git.
DO $$ BEGIN
  CREATE ROLE classia_app WITH LOGIN PASSWORD 'classia_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE classia_app WITH LOGIN PASSWORD 'classia_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO classia_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO classia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO classia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO classia_app;

-- Rol de bypass para SUPER_ADMIN/SUPPORT_AGENT en las pocas vistas
-- genuinamente cross-tenant (listado de tenants, dashboards agregados, el
-- job "sweep" de expiracion de accesos) -- trampa conocida #5 del plan: un
-- rol de Postgres nativo, no una variable de sesion custom que cualquier
-- codigo podria setear mal. Se crea SIN LOGIN aca (nada de credenciales de
-- este rol en una migracion versionada); habilitar el login real
-- (contraseña vía variable de entorno, fuera de git) es trabajo explícito
-- de quien conecte el segundo PrismaClient en la Fase 4, no de esta
-- migracion.
DO $$ BEGIN
  CREATE ROLE classia_platform_admin WITH NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO classia_platform_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO classia_platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO classia_platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO classia_platform_admin;
