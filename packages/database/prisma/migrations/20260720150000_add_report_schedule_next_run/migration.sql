-- Reprogramación dinámica de reportes: se guarda la próxima corrida calculada.
ALTER TABLE "report_schedules" ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3);
