-- Techo por colegio para la duración de un acceso de soporte concedido. Nullable
-- y sin default explícito (NULL = usa el techo absoluto del sistema); columna
-- nueva en una tabla existente, no destructiva, reversible con DROP COLUMN.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "maxAccessDurationMinutes" INTEGER;
