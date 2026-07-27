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
  status: "SUBMITTED" | "LATE" | "GRADED"
  attachmentKey?: string | null
  attachmentName?: string | null
  submittedAt?: string | null
  feedbackComment?: string | null
  feedbackKey?: string | null
  feedbackName?: string | null
  gradedAt?: string | null
  student?: { id: string; firstName: string; lastName: string }
}

/**
 * Una fila del roster de una tarea: **un estudiante del curso, haya entregado o no**.
 *
 * `submission === null` ES "no entregó". No existe un estado `PENDING` que represente eso: el
 * default del schema es inalcanzable porque ningún camino crea una entrega sin estado explícito
 * (`asignaciones-calificacion-en-linea.md` §5), y fabricar filas fantasma sería mentirle a la
 * lista sobre algo que el alumno nunca hizo.
 *
 * `submission.submittedAt === null` con `status: "GRADED"` es distinto: es "no entregó **y** ya
 * tiene nota", que es como queda un 0 puesto al cierre de periodo.
 */
export type RosterEntry = {
  student: { id: string; firstName: string; lastName: string; documentId?: string | null }
  /** `false` si se cambió de curso pero dejó su entrega en esta tarea. */
  inGroup: boolean
  submission: HomeworkSubmission | null
  /** Nota vigente. La liga con `Mark` es `(studentId, homeworkId)`, no una relación. */
  mark: { id: string; value: number; maxValue: number } | null
}

/**
 * `PENDING` salió del vocabulario el 2026-07-26: era el default del schema y **ningún camino
 * del backend lo escribe**, así que este label nunca se renderizó. "No entregó" se deriva de
 * `submission === null` en el roster, que es más honesto que fabricar una fila fantasma.
 *
 * Los mapas se leen con `?? ` por si un dato viejo trae ese estado: un `undefined` acá rompe la
 * fila entera, y perder el color no vale eso.
 */
export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Entregado",
  LATE: "Entregado tarde",
  GRADED: "Calificado",
}

export const SUBMISSION_STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  LATE: "bg-amber-100 text-amber-700",
  GRADED: "bg-success/10 text-success",
}

export const NOT_SUBMITTED_LABEL = "Sin entregar"
export const NOT_SUBMITTED_COLOR = "bg-muted text-muted-foreground"
