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
  dueDate: string
  weight: number
  type: HomeworkType
  allowNavigation: boolean
  attachmentKey?: string | null
  attachmentName?: string | null
  status: string
  createdAt: string
  group: { id: string; name: string; grade: string; section: string; _count?: { students: number } }
  subject: { id: string; name: string; code?: string | null }
  _count?: { submissions: number; marks: number }
}
