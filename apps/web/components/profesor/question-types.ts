export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Opción múltiple",
  TRUE_FALSE: "Verdadero / Falso",
  SHORT_ANSWER: "Respuesta corta",
}

export type QuestionOption = {
  id: string
  text: string
  isCorrect: boolean
  feedback?: string | null
  order: number
}

export type Question = {
  id: string
  homeworkId: string
  type: QuestionType
  text: string
  points: number
  imageKey?: string | null
  imageName?: string | null
  order: number
  createdAt: string
  options: QuestionOption[]
}
