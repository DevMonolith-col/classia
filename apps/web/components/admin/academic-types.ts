export type Subject = {
  id: string
  tenantId: string
  name: string
  code?: string | null
  _count?: { schedules?: number; marks?: number; homework?: number }
}

export type Group = {
  id: string
  name: string
  grade: string
  section: string
  tenant?: { id: string; name: string; slug: string }
  _count?: { students?: number; schedules?: number; attendanceSessions?: number; homework?: number }
}

export type Teacher = {
  id: string
  tenantId: string
  user: { id: string; email: string; firstName: string; lastName: string; status?: string }
  _count?: { schedules?: number; attendanceSessions?: number; marks?: number; homework?: number }
}

export type Schedule = {
  id: string
  tenantId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room?: string | null
  group: Group
  subject: { id: string; name: string; code?: string | null }
  teacher: { id: string; user: { id: string; firstName: string; lastName: string; email: string } }
}

export const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
}
