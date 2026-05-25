export const APP_NAME = "Classia";

export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  TENANT_ADMIN: "tenant_admin",
  PRINCIPAL: "principal",
  COORDINATOR: "coordinator",
  SECRETARY: "secretary",
  TEACHER: "teacher",
  GUARDIAN: "guardian",
  STUDENT: "student",
  SUPPORT_AGENT: "support_agent",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
  JUSTIFIED: "justified",
  UNJUSTIFIED: "unjustified",
  PERMISSION: "permission",
} as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];
