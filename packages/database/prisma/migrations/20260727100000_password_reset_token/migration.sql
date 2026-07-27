-- Tokens de un solo uso para restablecer la contraseña olvidada.
--
-- Tabla nueva y vacía: migración puramente aditiva, sin backfill.
--
-- Es **tenant-owned** aunque la contraseña que termina cambiando viva en `users`, que es
-- global. El token se emite desde el colegio por el que la persona entró, y acotarlo ahí evita
-- que pedir un reseteo en un colegio produzca una credencial utilizable desde otro.
--
-- Mismo detalle que calendar_feed_tokens: el enlace del correo se abre **sin sesión**, así que
-- la búsqueda del token corre sin contexto de tenant y con esta política devolvería cero filas.
-- Ese único lookup va por el rol de bypass, buscando por hash exacto y devolviendo lo mínimo;
-- de ahí en adelante todo el trabajo real ocurre dentro de `runWithTenant` con el tenant que
-- salió del token. Ver AuthService#resolveResetTokenAcrossTenants.
--
-- Los privilegios para classia_app y classia_platform_admin los cubre el ALTER DEFAULT
-- PRIVILEGES de 20260722120000_rls_app_roles.

CREATE TABLE "password_reset_tokens" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  -- sha256 hex del token. El token en claro solo existe en el enlace del correo; si la base
  -- se filtra, los tokens vivos no sirven para nada.
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  -- Marca el consumo. La fila se conserva en vez de borrarse para poder distinguir "este
  -- enlace ya se usó" de "este enlace nunca existió".
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_tenantId_userId_idx" ON "password_reset_tokens"("tenantId", "userId");
-- Para poder barrer los vencidos sin escanear la tabla entera.
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Política estándar, idéntica a las otras tablas tenant-owned.
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "password_reset_tokens"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;
