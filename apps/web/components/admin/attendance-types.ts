export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" | "PERMISSION"

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  LATE: "Tarde",
  JUSTIFIED: "Justificado",
  PERMISSION: "Permiso",
}

export const ATTENDANCE_STATUS_SHORT: Record<AttendanceStatus, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "T",
  JUSTIFIED: "J",
  PERMISSION: "Pe",
}

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-500 text-white",
  ABSENT: "bg-red-500 text-white",
  LATE: "bg-amber-500 text-white",
  JUSTIFIED: "bg-blue-500 text-white",
  PERMISSION: "bg-purple-500 text-white",
}

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
