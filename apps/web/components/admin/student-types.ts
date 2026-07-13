export type StudentGuardianLink = {
  relationship: string
  isPrimary: boolean
  guardian: {
    id: string
    user: { id: string; firstName: string; lastName: string; email: string }
  }
}

export type Student = {
  id: string
  firstName: string
  lastName: string
  documentId?: string | null
  birthDate?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  tenant: { id: string; name: string; slug: string }
  group: { id: string; name: string; grade: string; section: string } | null
  guardians: StudentGuardianLink[]
}

export type Guardian = {
  id: string
  tenantId: string
  user: { id: string; firstName: string; lastName: string; email: string; status?: string }
}
