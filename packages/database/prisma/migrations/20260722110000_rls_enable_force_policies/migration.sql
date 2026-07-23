-- Fase 2 de docs/planning/aislamiento-rls-multitenant.md: habilita y fuerza
-- Row-Level Security en las 46 tablas tenant-owned "estandar" (tenantId NOT
-- NULL) mas 2 tablas con tenantId nullable por diseno (auth_sessions,
-- audit_logs -- sesiones/acciones de plataforma sin colegio asociado).
--
-- IMPORTANTE (ver docs/planning/aislamiento-rls-multitenant.md, seccion
-- "Fase 2"): esta migracion por si sola, aplicada sin la Fase 4 (extension
-- de Prisma que hace SET LOCAL app.tenant_id en cada query), deja la app
-- COMPLETAMENTE rota -- FORCE ROW LEVEL SECURITY sin que nada setee
-- app.tenant_id hace que current_setting() devuelva NULL y ninguna fila
-- pase la politica. Las Fases 2 y 4 se aplican juntas, en el mismo tramo de
-- trabajo, precisamente para no dejar el entorno de dev en un estado roto
-- entre sesiones. No aplicar esta migracion de forma aislada.
--
-- Por que FORCE y no solo ENABLE: el rol "classia" (dueno de las tablas via
-- migraciones) ignora RLS por default en Postgres -- sin FORCE, las
-- politicas existirian en el schema pero no harian nada en la app real
-- (trampa conocida #1 del plan).
--
-- Patron por tabla: ENABLE + FORCE + una sola politica FOR ALL (mismo
-- USING y WITH CHECK, ya que el criterio de aislamiento es identico para
-- lectura y escritura). Idempotente via DO/EXCEPTION igual que el resto de
-- las migraciones del repo.

-- tenant_memberships
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_memberships" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "tenant_memberships"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- groups
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "groups"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- subjects
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "subjects"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- students
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "students"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- guardians
ALTER TABLE "guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardians" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "guardians"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- student_guardians
ALTER TABLE "student_guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_guardians" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "student_guardians"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- teachers
ALTER TABLE "teachers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teachers" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "teachers"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- schedules
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedules" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "schedules"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- attendance_sessions
ALTER TABLE "attendance_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_sessions" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "attendance_sessions"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- attendance_records
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "attendance_records"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- marks
ALTER TABLE "marks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marks" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "marks"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- academic_years
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "academic_years"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- academic_periods
ALTER TABLE "academic_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_periods" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "academic_periods"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- grading_scales
ALTER TABLE "grading_scales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grading_scales" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "grading_scales"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- grading_scale_bands
ALTER TABLE "grading_scale_bands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grading_scale_bands" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "grading_scale_bands"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- grading_categories
ALTER TABLE "grading_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grading_categories" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "grading_categories"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- report_cards
ALTER TABLE "report_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_cards" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "report_cards"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- report_card_lines
ALTER TABLE "report_card_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_card_lines" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "report_card_lines"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- homework
ALTER TABLE "homework" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "homework" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "homework"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- questions
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "questions"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- question_options
ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_options" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "question_options"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- quiz_attempts
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_attempts" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "quiz_attempts"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- quiz_answers
ALTER TABLE "quiz_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_answers" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "quiz_answers"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- homework_submissions
ALTER TABLE "homework_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "homework_submissions" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "homework_submissions"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- conversations
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "conversations"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- conversation_members
ALTER TABLE "conversation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_members" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "conversation_members"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- conversation_messages
ALTER TABLE "conversation_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_messages" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "conversation_messages"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- events
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "events"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- announcements
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "announcements"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- announcement_reads
ALTER TABLE "announcement_reads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_reads" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "announcement_reads"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- notifications
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "notifications"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- notification_deliveries
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_deliveries" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "notification_deliveries"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- support_tickets
ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_tickets" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "support_tickets"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- access_sessions
ALTER TABLE "access_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_sessions" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "access_sessions"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ticket_comments
ALTER TABLE "ticket_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_comments" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "ticket_comments"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- elections
ALTER TABLE "elections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "elections" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "elections"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- election_candidates
ALTER TABLE "election_candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "election_candidates" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "election_candidates"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- election_votes
ALTER TABLE "election_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "election_votes" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "election_votes"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- election_voters
ALTER TABLE "election_voters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "election_voters" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "election_voters"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- document_templates
ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_templates" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "document_templates"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- document_issuances
ALTER TABLE "document_issuances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_issuances" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "document_issuances"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- fee_concepts
ALTER TABLE "fee_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_concepts" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "fee_concepts"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "invoices"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- payments
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "payments"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- generated_reports
ALTER TABLE "generated_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_reports" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "generated_reports"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- report_schedules
ALTER TABLE "report_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_schedules" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "report_schedules"
    FOR ALL
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- auth_sessions y audit_logs: tenantId es nullable por diseno (sesiones y
-- acciones a nivel de plataforma, sin colegio asociado -- ej. un SUPER_ADMIN
-- operando fuera del contexto de un tenant especifico). La politica deja
-- pasar filas con tenantId NULL ademas de las que matchean el tenant activo:
-- no filtra MENOS que antes (esas filas ya eran visibles a nivel de
-- plataforma en el codigo de aplicacion), y sigue bloqueando el acceso
-- cruzado a filas de OTRO tenant especifico.

ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_sessions" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "auth_sessions"
    FOR ALL
    USING ("tenantId" IS NULL OR "tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" IS NULL OR "tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "audit_logs"
    FOR ALL
    USING ("tenantId" IS NULL OR "tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" IS NULL OR "tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Rol de bypass para SUPER_ADMIN/SUPPORT_AGENT en las pocas vistas
-- genuinamente cross-tenant (listado de tenants, dashboards agregados) --
-- trampa conocida #5 del plan: un rol de Postgres nativo, no una variable de
-- sesion custom que cualquier codigo podria setear mal. Se crea SIN LOGIN
-- aca (nada de credenciales en una migracion versionada); habilitar el
-- login real (contraseña vía variable de entorno, fuera de git) y el
-- segundo PrismaClient que lo usa es trabajo de la Fase 4.
DO $$ BEGIN
  CREATE ROLE classia_platform_admin WITH NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO classia_platform_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO classia_platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO classia_platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO classia_platform_admin;
