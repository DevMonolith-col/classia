-- Solicitudes de demo / cotización que llegan del sitio público.
--
-- Tabla nueva y vacía: migración puramente aditiva, sin backfill.
--
-- DELIBERADAMENTE SIN ROW LEVEL SECURITY, y por una razón distinta de las otras tres tablas
-- globales del repo: acá no es que el dato sea "de la plataforma", es que **el colegio todavía
-- no existe**. Quien manda el formulario es un rector que está evaluando Classia; no hay
-- tenant al que pertenezca la fila, así que no hay `tenantId` con el cual escribir una
-- política. Peor: el POST corre sin sesión y sin `x-tenant-slug`, así que
-- current_setting('app.tenant_id') es NULL y una política estándar rechazaría el INSERT
-- (RLS falla cerrado) — la feature no filtraría datos, simplemente no funcionaría.
--
-- La tabla está en GLOBAL_ALLOWLIST de scripts/verify-rls.ts con esa justificación. Ojo:
-- verify-rls.ts avisa si una tabla de la lista blanca aparece CON RLS habilitado, así que no
-- agregar ENABLE/FORCE acá sin sacarla antes de la lista.
--
-- El control de acceso es por ROL, en el controller: escribir es público (con rate-limit por
-- IP, como el resto de los endpoints sin sesión), y leer exige DEMO_REQUESTS_LIST/READ, que
-- hoy solo tiene SUPER_ADMIN. Ningún endpoint devuelve una solicitud sin sesión: el POST
-- responde 201 sin cuerpo, para que nadie pueda usarlo como oráculo.
--
-- Los privilegios de classia_app los cubre el ALTER DEFAULT PRIVILEGES de
-- 20260722120000_rls_app_roles (esta tabla la crea el mismo rol dueño, `classia`).
--
-- Idempotente, como el resto de las migraciones del repo.

DO $$ BEGIN
  CREATE TYPE "DemoRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "demo_requests" (
  "id"           TEXT NOT NULL,
  "schoolName"   TEXT NOT NULL,
  "contactName"  TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "contactPhone" TEXT,
  "contactRole"  TEXT,
  "city"         TEXT,
  -- Cuántos estudiantes tiene el colegio: es el dato que más mueve la cotización, y por eso
  -- el formulario lo pide como rango y guarda el número. Nullable porque no siempre lo saben.
  "studentCount" INTEGER,
  "interests"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "message"      TEXT,
  "source"       TEXT,

  "status"         "DemoRequestStatus" NOT NULL DEFAULT 'NEW',
  -- El plan cotizado se guarda como texto, no como enum: los planes todavía no son un modelo
  -- (Tenant ni siquiera tiene columna `plan`), y fijarlos en la base obligaría a migrar cada
  -- vez que cambie el pricing comercial.
  "quotedPlan"     TEXT,
  "quotedAmount"   DECIMAL(12,2),
  "quotedCurrency" TEXT,
  "quotedAt"       TIMESTAMP(3),
  -- Notas internas del equipo comercial. Nunca se le muestran al colegio: no hay endpoint que
  -- las devuelva sin sesión.
  "internalNotes"  TEXT,
  "handledById"    TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- La bandeja se ordena por fecha dentro de cada estado ("las nuevas primero").
CREATE INDEX IF NOT EXISTS "demo_requests_status_createdAt_idx" ON "demo_requests"("status", "createdAt");

-- SET NULL y no RESTRICT: si el usuario que atendió una solicitud se borra, la solicitud debe
-- sobrevivir — el dato comercial vale más que saber quién la tomó.
DO $$ BEGIN
  ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_handledById_fkey"
    FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
