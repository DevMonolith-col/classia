export type UserRole =
  | "SUPER_ADMIN"
  | "SUPPORT_AGENT"
  | "TENANT_ADMIN"
  | "PRINCIPAL"
  | "COORDINATOR"
  | "SECRETARY"
  | "TEACHER"
  | "GUARDIAN"
  | "STUDENT"

export type UserStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED"

export type MembershipStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Administrador",
  SUPPORT_AGENT: "Agente de Soporte",
  TENANT_ADMIN: "Administrador",
  PRINCIPAL: "Rector",
  COORDINATOR: "Coordinador",
  SECRETARY: "Secretaria",
  TEACHER: "Docente",
  GUARDIAN: "Acudiente",
  STUDENT: "Estudiante",
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: "Pendiente",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  SUSPENDED: "Suspendido",
}

export const USER_STATUS_CLASSNAME: Record<UserStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  INACTIVE: "border-neutral-200 bg-neutral-50 text-neutral-500",
  SUSPENDED: "border-red-200 bg-red-50 text-red-700",
}

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  SUSPENDED: "Suspendida",
}

export type Membership = {
  id: string
  role: UserRole
  status: MembershipStatus
  tenant: { id: string; name: string; slug: string; status?: string }
}

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  status: UserStatus
  createdAt: string
  updatedAt?: string
  memberships: Membership[]
}
