-- Recurrencia de reportes programados: reemplaza el enum fijo WEEKLY/MONTHLY
-- por un modelo flexible (cada N días, o cada N meses en un día fijo).

DO $$ BEGIN
  CREATE TYPE "ReportFrequencyType" AS ENUM ('DAYS', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "report_schedules" DROP COLUMN IF EXISTS "frequency";
ALTER TABLE "report_schedules" ADD COLUMN IF NOT EXISTS "dayOfMonth" INTEGER;
ALTER TABLE "report_schedules" ADD COLUMN IF NOT EXISTS "intervalValue" INTEGER;
ALTER TABLE "report_schedules" ADD COLUMN IF NOT EXISTS "frequencyType" "ReportFrequencyType";

-- La tabla está vacía en todo entorno donde esto se aplique (el módulo se
-- construyó en esta misma rama), así que es seguro forzar NOT NULL directo.
ALTER TABLE "report_schedules" ALTER COLUMN "dayOfMonth" DROP NOT NULL;
ALTER TABLE "report_schedules" ALTER COLUMN "intervalValue" SET NOT NULL;
ALTER TABLE "report_schedules" ALTER COLUMN "frequencyType" SET NOT NULL;

DROP TYPE IF EXISTS "ReportFrequency";
