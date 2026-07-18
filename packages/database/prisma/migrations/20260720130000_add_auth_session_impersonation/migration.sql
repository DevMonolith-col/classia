-- Tanda de seguridad (auditoría 2026-07): impersonación efímera + secreto del voto.
-- Idempotente.

-- Impersonación como sesión efímera: el rol efectivo vive en la propia AuthSession
-- (no se crea ninguna TenantMembership).
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "isImpersonated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "impersonatedRole" "UserRole";

-- Secreto del voto: quitar el timestamp correlacionable de election_votes. Al
-- insertarse en la misma transacción que election_voters.votedAt, era idéntico y
-- único por votante → permitía deducir por quién votó cada estudiante con un JOIN.
ALTER TABLE "election_votes" DROP COLUMN IF EXISTS "createdAt";
