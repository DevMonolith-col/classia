-- Gobierno Escolar (Votaciones) y Documentos/Certificados.

DO $$ BEGIN
  CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentType" AS ENUM ('STUDY_CERTIFICATE', 'REPORT_CARD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "elections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "allowBlank" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "election_candidates" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "studentId" TEXT,
    "candidateNumber" INTEGER NOT NULL,
    "slogan" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "election_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "election_votes" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "election_voters" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "election_voters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_issuances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reportCardId" TEXT,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "verificationCode" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "pdfKey" TEXT,
    "errorMessage" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "document_issuances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "elections_tenantId_status_idx" ON "elections"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "election_candidates_electionId_candidateNumber_key" ON "election_candidates"("electionId", "candidateNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "election_voters_electionId_studentId_key" ON "election_voters"("electionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "document_templates_tenantId_type_key" ON "document_templates"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "document_issuances_verificationCode_key" ON "document_issuances"("verificationCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_issuances_tenantId_studentId_idx" ON "document_issuances"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_issuances_verificationCode_idx" ON "document_issuances"("verificationCode");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "elections" ADD CONSTRAINT "elections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "elections" ADD CONSTRAINT "elections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "election_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "election_voters" ADD CONSTRAINT "election_voters_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "election_voters" ADD CONSTRAINT "election_voters_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "document_issuances" ADD CONSTRAINT "document_issuances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "document_issuances" ADD CONSTRAINT "document_issuances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "document_issuances" ADD CONSTRAINT "document_issuances_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "report_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "document_issuances" ADD CONSTRAINT "document_issuances_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
