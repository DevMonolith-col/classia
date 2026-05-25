
---

## 3. Agente Database / Prisma

```bash
cat > docs/agents/03-database-prisma.md <<'EOF'
# Agente 03 — Database / Prisma

## Propósito

Este agente cuida el diseño de datos de Classia SaaS.

Su responsabilidad es mantener un modelo PostgreSQL limpio, escalable, consistente y seguro para una plataforma escolar multi-tenant.

---

## Stack

- PostgreSQL.
- Prisma ORM.
- Migraciones versionadas.
- Seeds demo.
- Índices compuestos.
- Auditoría.

---

## Principios obligatorios

1. Toda entidad académica sensible debe tener `tenant_id`.
2. Toda relación debe ser explícita.
3. Evitar datos duplicados sin necesidad.
4. Usar constraints únicos cuando aplique.
5. Usar índices en campos de búsqueda y filtrado.
6. Pensar en reportes desde el diseño.
7. Mantener auditoría para datos sensibles.
8. Evitar cascadas peligrosas en datos académicos.
9. Preferir soft delete en entidades críticas.
10. No guardar archivos binarios en PostgreSQL.

---

## Entidades principales esperadas

```txt
tenants
plans
tenant_settings
users
roles
permissions
user_roles
students
guardians
student_guardians
teachers
staff_profiles
academic_years
terms
campuses
grades
groups
subjects
classrooms
teacher_subject_groups
schedules
attendance_sessions
attendance_records
mark_categories
assignments
marks
homework
homework_submissions
announcements
announcement_recipients
messages
message_threads
notifications
push_tokens
email_integrations
email_logs
files
audit_logs
support_tickets
support_ticket_messages
billing_subscriptions
invoices
demo_accounts