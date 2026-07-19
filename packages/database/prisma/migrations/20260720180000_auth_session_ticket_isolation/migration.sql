-- Aísla el alcance de una impersonación por el ticket que la justificó, no solo
-- por (agente, colegio). Columna nullable: las sesiones normales (no
-- impersonadas) nunca tienen ticket. Reversible con DROP COLUMN si hace falta.
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;

DO $$ BEGIN
  ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
