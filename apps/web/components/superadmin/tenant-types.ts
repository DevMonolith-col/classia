export type TenantStatus = "DEMO" | "PILOT" | "ACTIVE" | "SUSPENDED" | "CANCELLED"

export type Tenant = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  primaryDomain?: string | null
  logoUrl?: string | null
  brandColor?: string | null
  createdAt?: string
  updatedAt?: string
  // No hay un campo de plan/billing en el backend todavía; el frontend lo
  // trata como siempre "BASE" hasta que exista.
  plan?: string
  _count?: {
    memberships?: number
    students?: number
  }
}
