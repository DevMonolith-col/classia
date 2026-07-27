export type { AttendanceStatus } from "@/components/shared/attendance-constants"
export {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_SHORT,
  ATTENDANCE_STATUS_COLORS,
} from "@/components/shared/attendance-constants"
import type { AttendanceStatus } from "@/components/shared/attendance-constants"

export const STATUS_ORDER: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "JUSTIFIED", "PERMISSION"]

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
  createdAt?: string
  group: { id: string; name: string; grade: string; section: string }
  schedule: {
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    room?: string | null
    subject: { id: string; name: string; code?: string | null }
  } | null
  teacher: {
    id: string
    user: { id: string; firstName: string; lastName: string; email: string }
  }
  records: AttendanceRecord[]
}
