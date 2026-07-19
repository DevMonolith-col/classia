-- SupportTicket/TicketComment gained attachmentKey/attachmentName and an
-- `author` relation; the dev database already had these applied via db push
-- (see prior migration for context), this reconciles it the same way.

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "attachmentKey" TEXT;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;

ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "attachmentKey" TEXT;
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;

DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
