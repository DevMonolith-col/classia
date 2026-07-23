-- Fase 1 de docs/planning/aislamiento-rls-multitenant.md: denormaliza
-- "tenantId" en las tablas que hoy solo se scopean por un padre, como
-- preparación para poder poner una única política RLS simple por tabla
-- en la Fase 2 (en vez de políticas con JOIN al padre, una por tabla).
--
-- Patrón repetido por tabla: columna nullable -> backfill desde el padre ->
-- NOT NULL -> FK -> índice. Idempotente: se puede correr más de una vez sin
-- error (ADD COLUMN IF NOT EXISTS, UPDATE solo afecta filas NULL, SET NOT
-- NULL es no-op si ya lo es, FK con manejo de duplicate_object).
--
-- Orden: primero los padres que a su vez son padres de otra tabla de esta
-- misma migración ("questions" antes que "question_options", que backfillea
-- desde "questions.tenantId", no directo desde "homework").

-- 1. student_guardians <- students
ALTER TABLE "student_guardians" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "student_guardians" sg SET "tenantId" = s."tenantId"
  FROM "students" s WHERE s.id = sg."studentId" AND sg."tenantId" IS NULL;
ALTER TABLE "student_guardians" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "student_guardians_tenantId_idx" ON "student_guardians"("tenantId");

-- 2. attendance_records <- attendance_sessions
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "attendance_records" ar SET "tenantId" = ats."tenantId"
  FROM "attendance_sessions" ats WHERE ats.id = ar."sessionId" AND ar."tenantId" IS NULL;
ALTER TABLE "attendance_records" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "attendance_records_tenantId_idx" ON "attendance_records"("tenantId");

-- 3. grading_scale_bands <- grading_scales
ALTER TABLE "grading_scale_bands" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "grading_scale_bands" gsb SET "tenantId" = gs."tenantId"
  FROM "grading_scales" gs WHERE gs.id = gsb."scaleId" AND gsb."tenantId" IS NULL;
ALTER TABLE "grading_scale_bands" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "grading_scale_bands" ADD CONSTRAINT "grading_scale_bands_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "grading_scale_bands_tenantId_idx" ON "grading_scale_bands"("tenantId");

-- 4. report_card_lines <- report_cards
ALTER TABLE "report_card_lines" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "report_card_lines" rcl SET "tenantId" = rc."tenantId"
  FROM "report_cards" rc WHERE rc.id = rcl."reportCardId" AND rcl."tenantId" IS NULL;
ALTER TABLE "report_card_lines" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "report_card_lines" ADD CONSTRAINT "report_card_lines_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "report_card_lines_tenantId_idx" ON "report_card_lines"("tenantId");

-- 5. questions <- homework (padre de question_options, va antes)
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "questions" q SET "tenantId" = h."tenantId"
  FROM "homework" h WHERE h.id = q."homeworkId" AND q."tenantId" IS NULL;
ALTER TABLE "questions" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "questions_tenantId_idx" ON "questions"("tenantId");

-- 6. question_options <- questions (ya con tenantId por el paso anterior)
ALTER TABLE "question_options" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "question_options" qo SET "tenantId" = q."tenantId"
  FROM "questions" q WHERE q.id = qo."questionId" AND qo."tenantId" IS NULL;
ALTER TABLE "question_options" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "question_options" ADD CONSTRAINT "question_options_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "question_options_tenantId_idx" ON "question_options"("tenantId");

-- 7. quiz_answers <- quiz_attempts
ALTER TABLE "quiz_answers" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "quiz_answers" qa SET "tenantId" = qat."tenantId"
  FROM "quiz_attempts" qat WHERE qat.id = qa."attemptId" AND qa."tenantId" IS NULL;
ALTER TABLE "quiz_answers" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "quiz_answers_tenantId_idx" ON "quiz_answers"("tenantId");

-- 8. homework_submissions <- homework
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "homework_submissions" hs SET "tenantId" = h."tenantId"
  FROM "homework" h WHERE h.id = hs."homeworkId" AND hs."tenantId" IS NULL;
ALTER TABLE "homework_submissions" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "homework_submissions_tenantId_idx" ON "homework_submissions"("tenantId");

-- 9. conversation_members <- conversations
ALTER TABLE "conversation_members" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "conversation_members" cm SET "tenantId" = c."tenantId"
  FROM "conversations" c WHERE c.id = cm."conversationId" AND cm."tenantId" IS NULL;
ALTER TABLE "conversation_members" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "conversation_members_tenantId_idx" ON "conversation_members"("tenantId");

-- 10. conversation_messages <- conversations
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "conversation_messages" cmsg SET "tenantId" = c."tenantId"
  FROM "conversations" c WHERE c.id = cmsg."conversationId" AND cmsg."tenantId" IS NULL;
ALTER TABLE "conversation_messages" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "conversation_messages_tenantId_idx" ON "conversation_messages"("tenantId");

-- 11. announcement_reads <- announcements
ALTER TABLE "announcement_reads" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "announcement_reads" ar SET "tenantId" = a."tenantId"
  FROM "announcements" a WHERE a.id = ar."announcementId" AND ar."tenantId" IS NULL;
ALTER TABLE "announcement_reads" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "announcement_reads_tenantId_idx" ON "announcement_reads"("tenantId");

-- 12. notification_deliveries <- notifications
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "notification_deliveries" nd SET "tenantId" = n."tenantId"
  FROM "notifications" n WHERE n.id = nd."notificationId" AND nd."tenantId" IS NULL;
ALTER TABLE "notification_deliveries" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "notification_deliveries_tenantId_idx" ON "notification_deliveries"("tenantId");

-- 13. ticket_comments <- support_tickets
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "ticket_comments" tc SET "tenantId" = st."tenantId"
  FROM "support_tickets" st WHERE st.id = tc."ticketId" AND tc."tenantId" IS NULL;
ALTER TABLE "ticket_comments" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "ticket_comments_tenantId_idx" ON "ticket_comments"("tenantId");

-- 14. election_candidates <- elections
ALTER TABLE "election_candidates" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "election_candidates" ec SET "tenantId" = e."tenantId"
  FROM "elections" e WHERE e.id = ec."electionId" AND ec."tenantId" IS NULL;
ALTER TABLE "election_candidates" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "election_candidates_tenantId_idx" ON "election_candidates"("tenantId");

-- 15. election_votes <- elections (no rompe el anonimato: identifica colegio, no votante)
ALTER TABLE "election_votes" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "election_votes" ev SET "tenantId" = e."tenantId"
  FROM "elections" e WHERE e.id = ev."electionId" AND ev."tenantId" IS NULL;
ALTER TABLE "election_votes" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "election_votes_tenantId_idx" ON "election_votes"("tenantId");

-- 16. election_voters <- elections
ALTER TABLE "election_voters" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "election_voters" evo SET "tenantId" = e."tenantId"
  FROM "elections" e WHERE e.id = evo."electionId" AND evo."tenantId" IS NULL;
ALTER TABLE "election_voters" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "election_voters" ADD CONSTRAINT "election_voters_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "election_voters_tenantId_idx" ON "election_voters"("tenantId");
