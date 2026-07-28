export type { AttendanceStatus } from "@/components/shared/attendance-constants"
export {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_SHORT,
  ATTENDANCE_STATUS_COLORS,
} from "@/components/shared/attendance-constants"
import type { AttendanceStatus } from "@/components/shared/attendance-constants"

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

export type AttendanceRecord = {
  id: string
  studentId: string
  status: AttendanceStatus
  observation?: string | null
  student: { id: string; firstName: string; lastName: string; documentId?: string | null }
}

export type AttendanceSession = {
  id: string
  date: string
  isOpen: boolean
  group: { id: string; name: string; grade: string; section: string }
  schedule: {
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    room?: string | null
    subject: { id: string; name: string; code?: string | null }
  } | null
  records: AttendanceRecord[]
  // Presente solo en la respuesta de POST /attendance/sessions: el día está marcado como no
  // lectivo en el calendario. Advierte, no bloquea (calendario.md §9.3).
  schoolDayOffWarning?: {
    eventId: string
    title: string
    type: string
    message: string
  } | null
}
