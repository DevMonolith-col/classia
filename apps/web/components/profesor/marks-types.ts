export const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
}

export type TeacherSchedule = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room?: string | null
  group: { id: string; name: string; grade: string; section: string }
  subject: { id: string; name: string; code?: string | null }
}

export type Student = {
  id: string
  firstName: string
  lastName: string
  documentId?: string | null
}

export type Mark = {
  id: string
  homeworkId?: string | null
  title: string
  value: number
  maxValue: number
  comment?: string | null
  period: number
  date: string
  isPublished: boolean
  student: Student
  subject: { id: string; name: string; code?: string | null }
  homework?: { id: string; title: string; weight: number } | null
}
