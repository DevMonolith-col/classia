-- El modelo `SystemSetting` entró al schema en 32770e3 ("feat: implement phase 1 of
-- superadmin audit") sin migración que lo acompañara, así que la tabla nunca existió en
-- ninguna base. Dos consecuencias, ambas confirmadas en vivo el 2026-07-26:
--
--   1. `settings.service.ts` (getSettings/updateSettings) consulta `system_settings` en cada
--      lectura y escritura de la configuración de plataforma, y contra una base sin la tabla
--      revienta con ERROR 42P01: relation "system_settings" does not exist. El módulo de
--      configuración de SUPER_ADMIN estaba roto de punta a punta.
--   2. `pnpm verify:rls` fallaba de forma permanente: el script recorre los modelos de Prisma
--      y reporta el que no existe en la base. Un verificador de aislamiento que está siempre
--      en rojo es peor que no tenerlo, porque entrena a ignorarlo.
--
-- DELIBERADAMENTE SIN ROW LEVEL SECURITY. `system_settings` es una de las cuatro tablas
-- genuinamente globales del repo y ya está en GLOBAL_ALLOWLIST de scripts/verify-rls.ts
-- ("configuración global de la plataforma, no de un colegio"): no tiene `tenantId` porque no
-- pertenece a ningún colegio, y darle una política de tenant la volvería ilegible para todos.
-- Solo un SUPER_ADMIN llega a escribirla (gateado en el controller). Ojo: verify-rls.ts avisa
-- si una tabla de la lista blanca aparece CON RLS habilitado, así que no agregar ENABLE/FORCE
-- acá sin sacarla antes de la lista.
--
-- Los privilegios de `classia_app` no se conceden explícitamente: 20260722120000_rls_app_roles
-- dejó un `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO
-- classia_app`, y esta tabla la crea el mismo rol dueño (`classia`, con el que corren las
-- migraciones), así que hereda el grant. Verificado consultando la tabla como `classia_app`.
--
-- Idempotente, como el resto de las migraciones del repo.
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");
