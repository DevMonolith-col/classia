-- Alerta al colegio cuando soporte usa el acceso de emergencia (break-glass),
-- que se concede sin aprobación previa del tenant.
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_ACCESS_EMERGENCY';
