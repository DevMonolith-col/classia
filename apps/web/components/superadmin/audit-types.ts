export type AuditLog = {
  id: string
  tenantId?: string | null
  userId?: string | null
  actorRole?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  oldValues?: unknown
  newValues?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export type AuditLogsResponse = {
  items: AuditLog[]
  pageInfo: {
    hasNextPage: boolean
    nextCursor?: string
  }
}
