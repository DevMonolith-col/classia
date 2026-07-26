-- Notificaciones del módulo de calendario (docs/planning/calendario.md, Fase 4).
--
--   EVENT_PUBLISHED: el colegio publicó un evento nuevo para tu audiencia.
--   EVENT_REMINDER:  falta poco para un evento, con la antelación que se le configuró
--                    (§9.5: configurable por evento, no fija).
--
-- Dos valores, dos statements: `ALTER TYPE ... ADD VALUE` no acepta lista. `IF NOT EXISTS`
-- lo hace idempotente, igual que 20260720170500_add_notification_event_access_emergency.
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'EVENT_PUBLISHED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'EVENT_REMINDER';
