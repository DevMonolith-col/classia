"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ChevronLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MathText } from "@/components/shared/math-text"
import type { Homework } from "@/components/profesor/homework-types"

type AttemptQuestion = {
  id: string
  questionId: string
  selectedOptionId: string | null
  textAnswer: string | null
  isCorrect: boolean | null
  pointsAwarded: number | null
  question: { id: string; type: string; text: string; points: number; order: number }
}

type Attempt = {
  id: string
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED"
  score: number | null
  maxScore: number | null
  startedAt: string
  submittedAt: string | null
  student: { id: string; firstName: string; lastName: string }
  answers: AttemptQuestion[]
}

export default function CalificarQuizPage() {
  const params = useParams<{ homeworkId: string }>()
  const router = useRouter()
  const homeworkId = params.homeworkId

  const [homework, setHomework] = useState<Homework | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [homeworkRes, attemptsRes] = await Promise.all([
        apiFetch(`/homework/${homeworkId}`, { silent: true }),
        apiFetch(`/homework/${homeworkId}/quiz/attempts`, { silent: true }),
      ])
      if (!homeworkRes.ok) throw new Error("No se pudo cargar la asignación.")
      if (!attemptsRes.ok) throw new Error("No se pudo cargar los intentos.")
      setHomework((await homeworkRes.json()) as Homework)
      setAttempts((await attemptsRes.json()) as Attempt[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [homeworkId])

  useEffect(() => {
    load()
  }, [load])

  const pendingCount = useMemo(
    () =>
      attempts.reduce(
        (count, attempt) =>
          count +
          attempt.answers.filter((a) => a.question.type === "SHORT_ANSWER" && a.pointsAwarded === null).length,
        0,
      ),
    [attempts],
  )

  function draftKey(attemptId: string, questionId: string) {
    return `${attemptId}:${questionId}`
  }

  async function handleGrade(attempt: Attempt, answer: AttemptQuestion) {
    const key = draftKey(attempt.id, answer.questionId)
    const raw = drafts[key]
    const pointsAwarded = Number(raw)
    if (raw === undefined || raw === "" || Number.isNaN(pointsAwarded) || pointsAwarded < 0) {
      toast.error("Ingresa un puntaje válido.")
      return
    }
    if (pointsAwarded > answer.question.points) {
      toast.error(`El puntaje no puede superar ${answer.question.points}.`)
      return
    }

    setSavingKey(key)
    try {
      const res = await apiFetch(
        `/homework/${homeworkId}/quiz/attempts/${attempt.id}/questions/${answer.questionId}/grade`,
        {
          method: "PATCH",
          body: JSON.stringify({ pointsAwarded }),
          silent: true,
        },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la calificación.")
      }
      toast.success("Respuesta calificada")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la calificación.")
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      </div>
    )
  }

  if (error || !homework) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error || "Asignación no encontrada."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => router.push(`/profesor/asignaciones/${homeworkId}`)}>
        <ChevronLeft className="h-4 w-4" />
        Volver a la asignación
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Calificar respuestas cortas</h1>
        <p className="mt-1 text-muted-foreground">
          {homework.title} · {pendingCount} respuesta{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"}
        </p>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">Aún no hay intentos entregados para esta asignación.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => {
            const shortAnswers = attempt.answers
              .filter((a) => a.question.type === "SHORT_ANSWER")
              .sort((a, b) => a.question.order - b.question.order)

            if (shortAnswers.length === 0) return null

            return (
              <Card key={attempt.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>
                      {attempt.student.firstName} {attempt.student.lastName}
                    </CardTitle>
                    <Badge variant={attempt.status === "GRADED" ? "outline" : "secondary"}>
                      {attempt.status === "GRADED" ? "Calificado" : "Pendiente"}
                    </Badge>
                  </div>
                  {attempt.score !== null && attempt.maxScore !== null && (
                    <CardDescription>
                      Puntaje: {attempt.score}/{attempt.maxScore}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {shortAnswers.map((answer) => {
                    const key = draftKey(attempt.id, answer.questionId)
                    const isGraded = answer.pointsAwarded !== null
                    return (
                      <div key={answer.id} className="rounded-lg border border-border p-3">
                        <MathText text={answer.question.text} className="text-sm font-medium text-foreground" />
                        <p className="mt-2 rounded-md bg-secondary px-3 py-2 text-sm text-foreground">
                          {answer.textAnswer?.trim() || <span className="italic text-muted-foreground">Sin respuesta</span>}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={answer.question.points}
                            step={0.5}
                            className="w-24"
                            placeholder={isGraded ? String(answer.pointsAwarded) : "0"}
                            value={drafts[key] ?? (isGraded ? String(answer.pointsAwarded) : "")}
                            onChange={(e) => setDrafts((c) => ({ ...c, [key]: e.target.value }))}
                          />
                          <span className="text-xs text-muted-foreground">/ {answer.question.points} pts</span>
                          <Button
                            size="sm"
                            onClick={() => handleGrade(attempt, answer)}
                            disabled={savingKey === key}
                          >
                            {savingKey === key && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            {isGraded ? "Actualizar" : "Calificar"}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
