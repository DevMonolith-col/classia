"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { MathText } from "@/components/shared/math-text"
import { RemoteImage } from "@/components/shared/remote-image"

type QuizOption = { id: string; text: string; isCorrect?: boolean; feedback?: string | null }
type QuizQuestion = {
  id: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER"
  text: string
  points: number
  order: number
  imageKey?: string | null
  imageName?: string | null
  options: QuizOption[]
}
type QuizAnswer = { questionId: string; selectedOptionId: string | null; textAnswer: string | null; isCorrect?: boolean | null; pointsAwarded?: number | null }
type QuizAttempt = { id: string; status: "IN_PROGRESS" | "SUBMITTED" | "GRADED"; score: number | null; maxScore: number | null; startedAt: string; submittedAt: string | null; answers: QuizAnswer[] }
type QuizData = {
  homework: { id: string; title: string; description: string | null; dueDate: string; type: string; weight: number; allowNavigation: boolean }
  questions: QuizQuestion[]
  attempt: QuizAttempt | null
}

export default function AlumnoQuizPage() {
  const params = useParams<{ homeworkId: string }>()
  const router = useRouter()
  const homeworkId = params.homeworkId

  const [data, setData] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState<Record<string, { selectedOptionId?: string; textAnswer?: string }>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const savingRef = useRef<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/homework/${homeworkId}/quiz`, { silent: true })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message || "No se pudo cargar el quiz.")
      }
      const quizData = (await res.json()) as QuizData
      setData(quizData)
      setCurrentIndex(0)
      if (quizData.attempt) {
        const initial: Record<string, { selectedOptionId?: string; textAnswer?: string }> = {}
        for (const answer of quizData.attempt.answers) {
          initial[answer.questionId] = {
            selectedOptionId: answer.selectedOptionId ?? undefined,
            textAnswer: answer.textAnswer ?? undefined,
          }
        }
        setAnswers(initial)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [homeworkId])

  useEffect(() => {
    load()
  }, [load])

  async function startAttempt() {
    setStarting(true)
    try {
      const res = await apiFetch(`/homework/${homeworkId}/quiz/attempts`, { method: "POST", silent: true })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message || "No se pudo iniciar el quiz.")
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar el quiz.")
    } finally {
      setStarting(false)
    }
  }

  async function saveAnswer(questionId: string, value: { selectedOptionId?: string; textAnswer?: string }) {
    if (!data?.attempt) return
    setAnswers((c) => ({ ...c, [questionId]: value }))
    savingRef.current[questionId] = true
    try {
      await apiFetch(`/homework/${homeworkId}/quiz/attempts/${data.attempt.id}/answers`, {
        method: "PATCH",
        body: JSON.stringify({ questionId, ...value }),
        silent: true,
      })
    } catch {
      toast.error("No se pudo guardar tu respuesta.")
    } finally {
      savingRef.current[questionId] = false
    }
  }

  async function confirmSubmit() {
    setConfirmOpen(false)
    if (!data?.attempt) return

    setSubmitting(true)
    try {
      const res = await apiFetch(`/homework/${homeworkId}/quiz/attempts/${data.attempt.id}/submit`, {
        method: "POST",
        silent: true,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message || "No se pudo enviar el quiz.")
      }
      toast.success("Quiz enviado")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el quiz.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => router.push("/alumno/asignaciones")}>
        <ChevronLeft className="h-4 w-4" />
        Volver a asignaciones
      </Button>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{data.homework.title}</h1>
            {data.homework.description && (
              <MathText text={data.homework.description} className="mt-1 block text-muted-foreground" />
            )}
          </div>

          {data.questions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
                <p className="text-sm text-muted-foreground">Tu profesor aún no ha agregado preguntas a esta evaluación.</p>
              </CardContent>
            </Card>
          ) : !data.attempt ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {data.questions.length} pregunta{data.questions.length === 1 ? "" : "s"} · una vez que empieces podrás guardar tus
                  respuestas, pero no podrás modificarlas después de enviar.
                </p>
                <Button onClick={startAttempt} disabled={starting}>
                  {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Empezar
                </Button>
              </CardContent>
            </Card>
          ) : data.attempt.status === "IN_PROGRESS" ? (
            (() => {
              const allowNav = data.homework.allowNavigation
              const question = data.questions[currentIndex]
              const isLast = currentIndex === data.questions.length - 1
              const isAnswered = (q: QuizQuestion) => Boolean(answers[q.id]?.selectedOptionId || answers[q.id]?.textAnswer)

              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Pregunta {currentIndex + 1} de {data.questions.length}
                    </p>
                    {allowNav && (
                      <div className="flex flex-wrap gap-1.5">
                        {data.questions.map((q, i) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setCurrentIndex(i)}
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                              i === currentIndex
                                ? "bg-primary text-primary-foreground"
                                : isAnswered(q)
                                  ? "bg-green-100 text-green-700"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-medium">
                          <MathText text={question.text} />
                        </CardTitle>
                        <Badge variant="outline" className="shrink-0">{question.points} pts</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {question.imageKey && (
                        <RemoteImage
                          fileKey={question.imageKey}
                          alt={question.imageName ?? "Imagen de la pregunta"}
                          className="mb-4 max-h-80 rounded-lg border border-border object-contain"
                        />
                      )}
                      {question.type === "SHORT_ANSWER" ? (
                        <Textarea
                          value={answers[question.id]?.textAnswer ?? ""}
                          onChange={(e) => saveAnswer(question.id, { textAnswer: e.target.value })}
                          placeholder="Escribe tu respuesta..."
                          rows={3}
                        />
                      ) : (
                        <RadioGroup
                          value={answers[question.id]?.selectedOptionId ?? ""}
                          onValueChange={(v) => saveAnswer(question.id, { selectedOptionId: v })}
                          className="gap-3"
                        >
                          {question.options.map((option) => (
                            <div key={option.id} className="flex items-center gap-2">
                              <RadioGroupItem value={option.id} id={option.id} />
                              <Label htmlFor={option.id} className="cursor-pointer font-normal">
                                <MathText text={option.text} />
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex justify-between">
                    {allowNav ? (
                      <Button
                        variant="outline"
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex((i) => i - 1)}
                      >
                        Anterior
                      </Button>
                    ) : (
                      <span />
                    )}
                    {isLast ? (
                      <Button onClick={() => setConfirmOpen(true)} disabled={submitting} size="lg">
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar quiz
                      </Button>
                    ) : (
                      <Button onClick={() => setCurrentIndex((i) => i + 1)}>Siguiente</Button>
                    )}
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                  {data.attempt.status === "GRADED" ? (
                    <>
                      <CheckCircle2 className="h-10 w-10 text-green-600" />
                      <p className="text-3xl font-bold text-foreground">
                        {data.attempt.score?.toFixed(1)} / {data.attempt.maxScore?.toFixed(1)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {data.attempt.maxScore ? `${Math.round(((data.attempt.score ?? 0) / data.attempt.maxScore) * 100)}%` : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-10 w-10 text-amber-500" />
                      <p className="text-sm text-muted-foreground">
                        Enviado. Algunas preguntas requieren calificación manual del profesor.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {data.questions.map((question, index) => {
                const answer = data.attempt!.answers.find((a) => a.questionId === question.id)
                return (
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-medium">
                          {index + 1}. <MathText text={question.text} />
                        </CardTitle>
                        {answer?.isCorrect !== undefined && answer?.isCorrect !== null && (
                          answer.isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                          )
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {question.imageKey && (
                        <RemoteImage
                          fileKey={question.imageKey}
                          alt={question.imageName ?? "Imagen de la pregunta"}
                          className="mb-4 max-h-80 rounded-lg border border-border object-contain"
                        />
                      )}
                      {question.type === "SHORT_ANSWER" ? (
                        <p className="text-sm text-muted-foreground">Tu respuesta: {answer?.textAnswer || "(sin responder)"}</p>
                      ) : (
                        <ul className="space-y-1">
                          {question.options.map((option) => {
                            const wasSelected = answer?.selectedOptionId === option.id
                            return (
                              <li key={option.id}>
                                <span
                                  className={`text-sm ${
                                    option.isCorrect
                                      ? "font-medium text-green-700"
                                      : wasSelected
                                        ? "font-medium text-red-600"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {wasSelected ? "→ " : "· "}
                                  <MathText text={option.text} />
                                  {option.isCorrect ? " (correcta)" : ""}
                                </span>
                                {(wasSelected || option.isCorrect) && option.feedback && (
                                  <p className="ml-4 mt-0.5 text-xs italic text-muted-foreground">{option.feedback}</p>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar tus respuestas?</AlertDialogTitle>
            <AlertDialogDescription>
              {data &&
                (() => {
                  const answeredCount = data.questions.filter(
                    (q) => answers[q.id]?.selectedOptionId || answers[q.id]?.textAnswer,
                  ).length
                  return answeredCount < data.questions.length
                    ? `Respondiste ${answeredCount} de ${data.questions.length} preguntas. No podrás modificar tus respuestas después de enviar.`
                    : "No podrás modificar tus respuestas después de enviar."
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
