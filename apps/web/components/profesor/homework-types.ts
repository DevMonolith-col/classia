export const HOMEWORK_TYPES = ["TAREA", "EXAMEN", "QUIZ", "PROYECTO"] as const
export type HomeworkType = (typeof HOMEWORK_TYPES)[number]

export const HOMEWORK_TYPE_LABELS: Record<HomeworkType, string> = {
  TAREA: "Tarea",
  EXAMEN: "Examen",
  QUIZ: "Quiz",
  PROYECTO: "Proyecto",
}

export const HOMEWORK_TYPE_COLORS: Record<HomeworkType, string> = {
  TAREA: "bg-purple-100 text-purple-700",
  EXAMEN: "bg-red-100 text-red-700",
  QUIZ: "bg-cyan-100 text-cyan-700",
  PROYECTO: "bg-emerald-100 text-emerald-700",
}

export type Homework = {
  id: string
  title: string
  description?: string | null
  availableFrom?: string | null
  dueDate: string
  cutOffDate?: string | null
  weight: number
  type: HomeworkType
  allowNavigation: boolean
  attachmentKey?: string | null
  attachmentName?: string | null
  status: string
  createdAt: string
  group: { id: string; name: string; grade: string; section: string; _count?: { students: number } }
  subject: { id: string; name: string; code?: string | null }
  teacher?: { id: string; user: { id: string; firstName: string; lastName: string; email: string } }
  _count?: { submissions: number; marks: number }
}

export type HomeworkSubmission = {
  id: string
  homeworkId: string
  studentId: string
  status: "PENDING" | "SUBMITTED" | "LATE" | "GRADED"
  attachmentKey?: string | null
  attachmentName?: string | null
  submittedAt?: string | null
  feedbackComment?: string | null
  feedbackKey?: string | null
  feedbackName?: string | null
  gradedAt?: string | null
  student: { id: string; firstName: string; lastName: string }
}

export const SUBMISSION_STATUS_LABELS: Record<HomeworkSubmission["status"], string> = {
  PENDING: "Pendiente",
  SUBMITTED: "Entregado",
  LATE: "Entregado tarde",
  GRADED: "Calificado",
}

export const SUBMISSION_STATUS_COLORS: Record<HomeworkSubmission["status"], string> = {
  PENDING: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-100 text-blue-700",
  LATE: "bg-amber-100 text-amber-700",
  GRADED: "bg-success/10 text-success",
}
