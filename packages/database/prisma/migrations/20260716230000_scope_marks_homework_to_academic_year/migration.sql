-- Idempotente a propósito: en dev estos cambios pudieron aplicarse vía `db push`
-- antes de existir esta migración; en producción parte de cero.

-- AlterTable
ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;

-- AlterTable
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marks_academicYearId_idx" ON "marks"("academicYearId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "homework_academicYearId_idx" ON "homework"("academicYearId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "homework_tenantId_groupId_subjectId_idx" ON "homework"("tenantId", "groupId", "subjectId");

-- AddForeignKey (condicional: puede existir por db push previo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marks_academicYearId_fkey') THEN
    ALTER TABLE "marks" ADD CONSTRAINT "marks_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homework_academicYearId_fkey') THEN
    ALTER TABLE "homework" ADD CONSTRAINT "homework_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
