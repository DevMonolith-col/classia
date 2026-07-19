ALTER TABLE "access_sessions" ADD COLUMN IF NOT EXISTS "requestedDurationMinutes" INTEGER NOT NULL DEFAULT 240;
