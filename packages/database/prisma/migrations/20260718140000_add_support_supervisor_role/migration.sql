-- Adds SUPPORT_SUPERVISOR: leads the support team (assigns tickets, grants
-- tenant access) without holding full platform-admin power like SUPER_ADMIN.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT_SUPERVISOR';
