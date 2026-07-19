-- Acceso de soporte con consentimiento: reemplaza la impersonación "silenciosa" por
-- un flujo de solicitud/aprobación con alcance (OPERATIVO vs DATOS_PERSONALES),
-- expiración y revocación. Ver AccessSession en schema.prisma.

DO $$ BEGIN
  CREATE TYPE "AccessScope" AS ENUM ('OPERATIVO', 'DATOS_PERSONALES');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccessSessionStatus" AS ENUM ('SOLICITADO', 'CONCEDIDO', 'EXPIRADO', 'REVOCADO', 'EMERGENCIA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "access_sessions" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "scope" "AccessScope" NOT NULL,
  "status" "AccessSessionStatus" NOT NULL DEFAULT 'SOLICITADO',
  "reason" TEXT NOT NULL,
  "denialReason" TEXT,
  "revokedReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "access_sessions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "access_sessions_tenantId_requestedById_status_idx"
  ON "access_sessions"("tenantId", "requestedById", "status");

CREATE INDEX IF NOT EXISTS "access_sessions_ticketId_idx"
  ON "access_sessions"("ticketId");
