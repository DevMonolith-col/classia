-- Tokens de suscripción al feed ICS del calendario (docs/planning/calendario.md, Fase 5).
--
-- Tabla nueva y vacía, así que acá no hay backfill que hacer: a diferencia de
-- 20260726130000_calendar_event_model, esta migración sí es puramente aditiva.
--
-- Es **tenant-owned** y por eso lleva la política estándar como los otros 46 modelos. El
-- detalle que importa: el feed se autentica por token en la URL, sin JWT y sin
-- `x-tenant-slug`, así que la búsqueda del token corre SIN contexto de tenant y con esta
-- política devolvería cero filas. Ese único lookup se hace con el rol de bypass (igual que
-- login/refresh, que tampoco conoce el tenant todavía); todo lo que se lee después va dentro
-- de `runWithTenant` con el tenant que salió del token. Ver §7.7 del plan y
-- CalendarFeedService#resolveTokenAcrossTenants.
--
-- Los privilegios para classia_app y classia_platform_admin los cubre el
-- ALTER DEFAULT PRIVILEGES de 20260722120000_rls_app_roles: aplica a las tablas que cree el
-- dueño (classia), que es justamente quien corre las migraciones.

CREATE TABLE "calendar_feed_tokens" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  -- sha256 hex del token. Nunca se guarda el token en claro: se muestra una sola vez al
  -- crearlo y después solo se puede revocar y regenerar.
  "tokenHash"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt"  TIMESTAMP(3),

  CONSTRAINT "calendar_feed_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_feed_tokens_tokenHash_key" ON "calendar_feed_tokens"("tokenHash");
CREATE INDEX "calendar_feed_tokens_tenantId_userId_idx" ON "calendar_feed_tokens"("tenantId", "userId");

ALTER TABLE "calendar_feed_tokens" ADD CONSTRAINT "calendar_feed_tokens_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_feed_tokens" ADD CONSTRAINT "calendar_feed_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Política estándar, idéntica a las otras 46 tablas tenant-owned.
ALTER TABLE "calendar_feed_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_feed_tokens" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "calendar_feed_tokens"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;
