-- Soft-delete de comunicados: se ocultan pero nunca se borran físicamente
-- (comunicación oficial, retención Ley 1620/527), igual que la mensajería.
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
