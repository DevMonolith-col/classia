-- Un boletín por estudiante/año/periodo: evita duplicados bajo generate()
-- concurrente (findFirst→miss→create en paralelo). Idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS "report_cards_studentId_academicYearId_periodId_key"
  ON "report_cards" ("studentId", "academicYearId", "periodId");

-- El boletín anual (periodId NULL) no lo cubre el unique de arriba, porque Postgres
-- trata cada NULL como distinto. Un índice parcial lo bloquea aparte.
CREATE UNIQUE INDEX IF NOT EXISTS "report_cards_student_year_annual_key"
  ON "report_cards" ("studentId", "academicYearId") WHERE "periodId" IS NULL;
