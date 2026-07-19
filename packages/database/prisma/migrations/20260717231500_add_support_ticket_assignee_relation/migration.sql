-- support_tickets.assigneeId had no FK constraint; the service layer expects
-- to `include: { assignee: ... }`, which requires the Prisma relation and its
-- backing foreign key.

CREATE INDEX IF NOT EXISTS "support_tickets_assigneeId_idx" ON "support_tickets"("assigneeId");

DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
