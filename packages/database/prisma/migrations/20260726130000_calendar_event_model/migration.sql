-- Modelo de calendario sobre "events" (docs/planning/calendario.md §5).
--
-- ESTA MIGRACIÓN NO ES ADITIVA. La tabla "events" ya existe y puede tener filas en
-- cualquier base que no sea de dev, así que tres de los cambios necesitan decidir qué
-- pasa con esas filas antes de poder aplicarse (§5.1):
--
--   1. "date" -> "startsAt" es un RENOMBRE, no una columna nueva. Prisma genera
--      DROP COLUMN + ADD COLUMN para esto porque no puede detectar renombres, y eso
--      borraría la fecha de todos los eventos existentes. Va RENAME a mano.
--   2. "endsAt" es NOT NULL y no hay valor previo del que derivarlo: se agrega nullable,
--      se rellena con "startsAt" (evento puntual) y solo entonces SET NOT NULL.
--   3. "updatedAt" cae en la misma trampa por ser @updatedAt: Prisma la emite como
--      ADD COLUMN ... NOT NULL sin default. Se rellena con "createdAt", que es el valor
--      honesto para una fila que nunca se editó.
--
-- Postgres rechaza ADD COLUMN ... NOT NULL sin default sobre una tabla con filas, así que
-- el atajo pasa en dev (donde la tabla está vacía) y explota en producción -- la peor
-- combinación posible. El antecedente es "marks"."academicYearId": columna agregada sin
-- backfill el 2026-07-16, nueve días de notas invisibles y una migración de reparación
-- (20260725120000_backfill_mark_academic_year).
--
-- RLS: "events" ya tiene ENABLE + FORCE ROW LEVEL SECURITY y la política
-- tenant_isolation desde 20260722110000_rls_enable_force_policies. "tenantId" se conserva
-- con el mismo nombre y tipo, así que la política sigue aplicando sin reescribirla y no
-- hay que tocar nada acá. Verificado con `pnpm verify:rls` después de aplicar.

-- ─── Tipo de evento ─────────────────────────────────────────────────────────────
CREATE TYPE "CalendarEventType" AS ENUM ('ACADEMICO', 'INSTITUCIONAL', 'REUNION', 'ADMINISTRATIVO', 'FESTIVO');

-- ─── Paso 1: renombrar "date" -> "startsAt" preservando los datos ───────────────
ALTER TABLE "events" RENAME COLUMN "date" TO "startsAt";

-- ─── Paso 2: columnas nuevas que sí son aditivas ────────────────────────────────
-- Todas tienen default o son nullable, así que no necesitan backfill.
ALTER TABLE "events"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "type" "CalendarEventType" NOT NULL DEFAULT 'INSTITUCIONAL',
  ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "targetRole" "UserRole",
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "isSchoolDayOff" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderMinutesBefore" INTEGER,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- ─── Paso 3: "endsAt" -- nullable, backfill, NOT NULL, en ese orden ─────────────
ALTER TABLE "events" ADD COLUMN "endsAt" TIMESTAMP(3);

-- Un evento preexistente solo tiene un instante, no una duración. Rellenar con
-- "startsAt" lo deja como evento puntual, que es lo que de hecho era. La alternativa
-- (fin del día en la tz del tenant) inventaría una duración que nadie capturó, y como
-- allDay queda en false por default, sería incoherente además de inventada.
UPDATE "events" SET "endsAt" = "startsAt" WHERE "endsAt" IS NULL;

ALTER TABLE "events" ALTER COLUMN "endsAt" SET NOT NULL;

-- ─── Paso 4: "updatedAt" -- mismo patrón, misma razón ───────────────────────────
ALTER TABLE "events" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- "createdAt" es el valor correcto para una fila que nunca se editó: now() diría que
-- todos los eventos viejos se modificaron el día de la migración, que es falso y además
-- rompería cualquier lectura incremental por "updatedAt".
UPDATE "events" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "events" ALTER COLUMN "updatedAt" SET NOT NULL;

-- ─── Paso 5: índices ────────────────────────────────────────────────────────────
-- El viejo (tenantId, date) se va con el renombre de la columna: Postgres lo mantiene
-- funcionando pero conserva el nombre "events_tenantId_date_idx", que ya no describe la
-- columna. Se borra y se recrean los dos de §5.
DROP INDEX IF EXISTS "events_tenantId_date_idx";
CREATE INDEX "events_tenantId_startsAt_idx" ON "events"("tenantId", "startsAt");
CREATE INDEX "events_tenantId_groupId_startsAt_idx" ON "events"("tenantId", "groupId", "startsAt");

-- ─── Paso 6: llaves foráneas de audiencia y autoría ─────────────────────────────
-- SET NULL en ambas porque las dos relaciones son opcionales: borrar un grupo no debe
-- borrar el evento institucional que lo mencionaba, y un evento sobrevive al usuario que
-- lo creó (createdById nullable ya significa "autor no registrado").
ALTER TABLE "events" ADD CONSTRAINT "events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
