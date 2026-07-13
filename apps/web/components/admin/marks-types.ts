export type Mark = {
  id: string
  tenantId: string
  homeworkId?: string | null
  title: string
  value: number
  maxValue: number
  period: number
  date: string
  isPublished: boolean
  student: { id: string; firstName: string; lastName: string; documentId?: string | null; groupId?: string | null }
  subject: { id: string; name: string; code?: string | null }
  teacher: { id: string; user: { id: string; firstName: string; lastName: string; email: string } }
  homework?: { id: string; title: string; weight: number } | null
}
