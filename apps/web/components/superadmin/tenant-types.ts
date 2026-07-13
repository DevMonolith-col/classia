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
  _count?: {
    users?: number
    memberships?: number
  }
}
