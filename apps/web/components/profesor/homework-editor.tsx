"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AttachmentPreviewDialog } from "@/components/shared/attachment-preview-dialog"
import { FileUploadField, type UploadedFileValue } from "@/components/shared/file-upload-field"
import { MathText } from "@/components/shared/math-text"
import { RemoteImage } from "@/components/shared/remote-image"
import {
  HOMEWORK_TYPE_LABELS,
  HOMEWORK_TYPES,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
  type Homework,
  type HomeworkSubmission,
  type HomeworkType,
} from "./homework-types"
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type Question, type QuestionType } from "./question-types"
import type { TeacherSchedule } from "./marks-types"

const QUIZ_LIKE_TYPES = new Set<HomeworkType>(["QUIZ", "EXAMEN"])

type FormState = {
  title: string
  description: string
  availableFrom: string
  dueDate: string
  cutOffDate: string
  weight: string
  type: HomeworkType
  allowNavigation: boolean
}

function defaultDueDate() {
  const now = new Date()
  now.setDate(now.getDate() + 7)
  now.setHours(23, 59, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  mode: "create" | "edit"
  schedule?: TeacherSchedule | null
  homework?: Homework | null
}

export function HomeworkEditor({ mode, schedule, homework }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [form, setForm] = useState<FormState>(() =>
    homework
      ? {
          title: homework.title,
          description: homework.description ?? "",
          availableFrom: homework.availableFrom ? toDatetimeLocalValue(homework.availableFrom) : "",
          dueDate: toDatetimeLocalValue(homework.dueDate),
          cutOffDate: homework.cutOffDate ? toDatetimeLocalValue(homework.cutOffDate) : "",
          weight: String(homework.weight),
          type: homework.type,
          allowNavigation: homework.allowNavigation,
        }
      : {
          title: "",
          description: "",
          availableFrom: "",
          dueDate: defaultDueDate(),
          cutOffDate: "",
          weight: "10",
          type: "TAREA",
          allowNavigation: true,
        },
  )
  const [attachment, setAttachment] = useState<UploadedFileValue>(
    homework?.attachmentKey ? { key: homework.attachmentKey, name: homework.attachmentName ?? "Archivo" } : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [currentHomeworkId, setCurrentHomeworkId] = useState<string | null>(homework?.id ?? null)

  const groupSubjectLabel = homework
    ? `${homework.group.name} · ${homework.subject.name}`
    : schedule
      ? `${schedule.group.name} · ${schedule.subject.name}`
      : ""

  async function handleSubmit() {
    setError("")

    if (!form.title.trim()) {
      setError("El título es obligatorio.")
      return
    }
    const weight = Number(form.weight)
    if (Number.isNaN(weight) || weight < 0 || weight > 100) {
      setError("El peso debe ser un número entre 0 y 100.")
      return
    }

    setSubmitting(true)
    try {
      const dueDateIso = new Date(form.dueDate).toISOString()
      const availableFromIso = form.availableFrom ? new Date(form.availableFrom).toISOString() : null
      const cutOffDateIso = form.cutOffDate ? new Date(form.cutOffDate).toISOString() : null
      const payload = isEdit
        ? {
            title: form.title.trim(),
            description: form.description.trim() || null,
            availableFrom: availableFromIso,
            dueDate: dueDateIso,
            cutOffDate: cutOffDateIso,
            weight,
            type: form.type,
            allowNavigation: form.allowNavigation,
            attachmentKey: attachment?.key ?? null,
            attachmentName: attachment?.name ?? null,
          }
        : {
            groupId: schedule!.group.id,
            subjectId: schedule!.subject.id,
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            availableFrom: availableFromIso ?? undefined,
            dueDate: dueDateIso,
            cutOffDate: cutOffDateIso ?? undefined,
            weight,
            type: form.type,
            allowNavigation: form.allowNavigation,
            attachmentKey: attachment?.key,
            attachmentName: attachment?.name,
          }

      const res = await apiFetch(isEdit ? `/homework/${currentHomeworkId}` : "/homework", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la asignación.")
      }

      const saved = (await res.json()) as Homework
      toast.success(isEdit ? "Cambios guardados" : "Asignación creada", { description: saved.title })

      if (!isEdit) {
        if (QUIZ_LIKE_TYPES.has(saved.type)) {
          router.push(`/profesor/asignaciones/${saved.id}`)
        } else {
          router.push("/profesor/asignaciones")
        }
      } else {
        setCurrentHomeworkId(saved.id)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar la asignación.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => router.push("/profesor/asignaciones")}>
        <ChevronLeft className="h-4 w-4" />
        Volver a asignaciones
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {isEdit ? "Editar asignación" : "Nueva asignación"}
        </h1>
        {groupSubjectLabel && <p className="mt-1 text-muted-foreground">{groupSubjectLabel}</p>}
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="homework-title">Título</Label>
              <Input
                id="homework-title"
                value={form.title}
                onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
                placeholder="Taller de fracciones"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homework-type">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((c) => ({ ...c, type: value as HomeworkType }))}
              >
                <SelectTrigger id="homework-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOMEWORK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {HOMEWORK_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="homework-weight">Peso en la nota (%)</Label>
              <Input
                id="homework-weight"
                type="number"
                min={0}
                max={100}
                value={form.weight}
                onChange={(event) => setForm((c) => ({ ...c, weight: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="homework-description">Descripción</Label>
            <Textarea
              id="homework-description"
              value={form.description}
              onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
              placeholder="Instrucciones para los estudiantes..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Fórmulas matemáticas: escribe entre signos de dólar, ej. <code>$x^2 + y^2 = z^2$</code>
            </p>
          </div>

          {QUIZ_LIKE_TYPES.has(form.type) && (
            <div className="space-y-2">
              <Label htmlFor="homework-navigation">Navegación entre preguntas</Label>
              <Select
                value={form.allowNavigation ? "FREE" : "SEQUENTIAL"}
                onValueChange={(value) => setForm((c) => ({ ...c, allowNavigation: value === "FREE" }))}
              >
                <SelectTrigger id="homework-navigation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Libre — puede ir y volver entre preguntas</SelectItem>
                  <SelectItem value="SEQUENTIAL">Secuencial — debe avanzar en orden, sin regresar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="homework-available-from">Disponible desde (opcional)</Label>
              <Input
                id="homework-available-from"
                type="datetime-local"
                value={form.availableFrom}
                onChange={(event) => setForm((c) => ({ ...c, availableFrom: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homework-due">Fecha y hora de entrega</Label>
              <Input
                id="homework-due"
                type="datetime-local"
                value={form.dueDate}
                onChange={(event) => setForm((c) => ({ ...c, dueDate: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homework-cutoff">Cierre de entregas (opcional)</Label>
              <Input
                id="homework-cutoff"
                type="datetime-local"
                value={form.cutOffDate}
                onChange={(event) => setForm((c) => ({ ...c, cutOffDate: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Tras esta fecha ya no se aceptan entregas. Si se deja vacío, no hay cierre.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Material adjunto (opcional)</Label>
            <FileUploadField value={attachment} onChange={setAttachment} disabled={submitting} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear asignación"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isEdit && currentHomeworkId && QUIZ_LIKE_TYPES.has(form.type) && (
        <>
          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/profesor/quiz/${currentHomeworkId}/calificar`)}
            >
              Calificar respuestas cortas
            </Button>
          </div>
          <QuestionsSection homeworkId={currentHomeworkId} />
        </>
      )}

      {isEdit && currentHomeworkId && !QUIZ_LIKE_TYPES.has(form.type) && (
        <SubmissionsSection homeworkId={currentHomeworkId} />
      )}
    </div>
  )
}

function SubmissionsSection({ homeworkId }: { homeworkId: string }) {
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([])
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState<HomeworkSubmission | null>(null)
  const [value, setValue] = useState("100")
  const [maxValue, setMaxValue] = useState("100")
  const [feedbackComment, setFeedbackComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<{ key: string; name: string } | null>(null)

  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/homework/${homeworkId}/submissions`, { silent: true })
      if (!res.ok) throw new Error()
      setSubmissions((await res.json()) as HomeworkSubmission[])
    } catch {
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }, [homeworkId])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  function openAttachment(key: string, name?: string | null) {
    setPreview({ key, name: name ?? "Archivo" })
  }

  function openGradeDialog(submission: HomeworkSubmission) {
    setGrading(submission)
    setValue("100")
    setMaxValue("100")
    setFeedbackComment(submission.feedbackComment ?? "")
  }

  async function handleGradeSubmit() {
    if (!grading) return
    const numericValue = Number(value)
    const numericMaxValue = Number(maxValue)
    if (Number.isNaN(numericValue) || Number.isNaN(numericMaxValue) || numericValue > numericMaxValue) {
      toast.error("La nota debe ser un número válido y no superar el máximo.")
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch(`/homework/${homeworkId}/submissions/${grading.id}/grade`, {
        method: "PATCH",
        body: JSON.stringify({
          value: numericValue,
          maxValue: numericMaxValue,
          feedbackComment: feedbackComment.trim() || undefined,
        }),
        silent: true,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo calificar la entrega.")
      }
      toast.success("Entrega calificada")
      setGrading(null)
      loadSubmissions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo calificar la entrega.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Entregas</CardTitle>
        <CardDescription>{submissions.length} entrega{submissions.length === 1 ? "" : "s"} recibida{submissions.length === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Aún no hay entregas de los estudiantes.
          </p>
        ) : grading ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">
              Calificar a {grading.student.firstName} {grading.student.lastName}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nota</Label>
                <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nota máxima</Label>
                <Input type="number" min={1} value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comentario (opcional)</Label>
              <Textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Retroalimentación para el estudiante..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setGrading(null)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleGradeSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar calificación
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((submission) => (
              <div key={submission.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {submission.student.firstName} {submission.student.lastName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge className={SUBMISSION_STATUS_COLORS[submission.status]} variant="outline">
                        {SUBMISSION_STATUS_LABELS[submission.status]}
                      </Badge>
                      {submission.submittedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(submission.submittedAt).toLocaleString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {submission.attachmentKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAttachment(submission.attachmentKey!, submission.attachmentName)}
                      >
                        Ver archivo
                      </Button>
                    )}
                    <Button size="sm" onClick={() => openGradeDialog(submission)}>
                      {submission.status === "GRADED" ? "Editar nota" : "Calificar"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AttachmentPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
        fileKey={preview?.key ?? null}
        fileName={preview?.name}
      />
    </Card>
  )
}

type OptionDraft = { text: string; isCorrect: boolean; feedback: string }

type QuestionFormState = {
  type: QuestionType
  text: string
  points: string
  options: OptionDraft[]
}

function emptyQuestionForm(): QuestionFormState {
  return {
    type: "MULTIPLE_CHOICE",
    text: "",
    points: "1",
    options: [
      { text: "", isCorrect: true, feedback: "" },
      { text: "", isCorrect: false, feedback: "" },
    ],
  }
}

function trueFalseOptions(): OptionDraft[] {
  return [
    { text: "Verdadero", isCorrect: true, feedback: "" },
    { text: "Falso", isCorrect: false, feedback: "" },
  ]
}

function QuestionsSection({ homeworkId }: { homeworkId: string }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Question | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<QuestionFormState>(emptyQuestionForm())
  const [image, setImage] = useState<UploadedFileValue>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/homework/${homeworkId}/questions`, { silent: true })
      if (!res.ok) throw new Error()
      setQuestions((await res.json()) as Question[])
    } catch {
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [homeworkId])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  function openAddForm() {
    setEditing(null)
    setForm(emptyQuestionForm())
    setImage(null)
    setError("")
    setShowForm(true)
  }

  function openEditForm(question: Question) {
    setEditing(question)
    setForm({
      type: question.type,
      text: question.text,
      points: String(question.points),
      options: question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, feedback: o.feedback ?? "" })),
    })
    setImage(question.imageKey ? { key: question.imageKey, name: question.imageName ?? "Imagen" } : null)
    setError("")
    setShowForm(true)
  }

  function handleTypeChange(type: QuestionType) {
    setForm((c) => ({
      ...c,
      type,
      options:
        type === "TRUE_FALSE" ? trueFalseOptions() : type === "MULTIPLE_CHOICE" ? (c.options.length >= 2 ? c.options : emptyQuestionForm().options) : [],
    }))
  }

  function updateOption(index: number, text: string) {
    setForm((c) => ({ ...c, options: c.options.map((o, i) => (i === index ? { ...o, text } : o)) }))
  }

  function updateOptionFeedback(index: number, feedback: string) {
    setForm((c) => ({ ...c, options: c.options.map((o, i) => (i === index ? { ...o, feedback } : o)) }))
  }

  function setCorrectOption(index: number) {
    setForm((c) => ({ ...c, options: c.options.map((o, i) => ({ ...o, isCorrect: i === index })) }))
  }

  function addOption() {
    setForm((c) => ({ ...c, options: [...c.options, { text: "", isCorrect: false, feedback: "" }] }))
  }

  function removeOption(index: number) {
    setForm((c) => {
      const options = c.options.filter((_, i) => i !== index)
      if (!options.some((o) => o.isCorrect) && options.length > 0) options[0].isCorrect = true
      return { ...c, options }
    })
  }

  async function handleSubmit() {
    setError("")

    if (!form.text.trim()) {
      setError("El texto de la pregunta es obligatorio.")
      return
    }
    const points = Number(form.points)
    if (Number.isNaN(points) || points <= 0) {
      setError("Los puntos deben ser un número mayor a 0.")
      return
    }
    if (form.type !== "SHORT_ANSWER") {
      const filled = form.options.filter((o) => o.text.trim())
      if (filled.length < 2) {
        setError("Agrega al menos 2 opciones.")
        return
      }
      if (!filled.some((o) => o.isCorrect)) {
        setError("Marca cuál opción es la correcta.")
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        type: form.type,
        text: form.text.trim(),
        points,
        options:
          form.type === "SHORT_ANSWER"
            ? undefined
            : form.options
                .filter((o) => o.text.trim())
                .map((o) => ({ text: o.text, isCorrect: o.isCorrect, feedback: o.feedback.trim() || undefined })),
        imageKey: editing ? (image?.key ?? null) : image?.key,
        imageName: editing ? (image?.name ?? null) : image?.name,
      }

      const res = await apiFetch(
        editing ? `/homework/${homeworkId}/questions/${editing.id}` : `/homework/${homeworkId}/questions`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
          silent: true,
        },
      )

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la pregunta.")
      }

      toast.success(editing ? "Pregunta actualizada" : "Pregunta agregada")
      setShowForm(false)
      loadQuestions()
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar la pregunta.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(question: Question) {
    try {
      const res = await apiFetch(`/homework/${homeworkId}/questions/${question.id}`, {
        method: "DELETE",
        silent: true,
      })
      if (!res.ok) throw new Error()
      toast.success("Pregunta eliminada")
      loadQuestions()
    } catch {
      toast.error("No se pudo eliminar la pregunta.")
    }
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Preguntas</CardTitle>
        <CardDescription>
          {questions.length} pregunta{questions.length === 1 ? "" : "s"} · {totalPoints} puntos en total
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" />
                Agregar pregunta
              </Button>
            </div>

            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary" />)
              ) : questions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Aún no hay preguntas. Agrega la primera.
                </p>
              ) : (
                questions.map((question, index) => (
                  <div key={question.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                          <Badge variant="outline">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                          <Badge variant="outline">{question.points} pts</Badge>
                        </div>
                        <MathText text={question.text} className="mt-1 block text-sm font-medium text-foreground" />
                        {question.imageKey && (
                          <RemoteImage
                            fileKey={question.imageKey}
                            alt={question.imageName ?? "Imagen de la pregunta"}
                            className="mt-2 max-h-32 rounded-lg border border-border object-contain"
                          />
                        )}
                        {question.options.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {question.options.map((option) => (
                              <li
                                key={option.id}
                                className={`text-xs ${option.isCorrect ? "font-medium text-green-700" : "text-muted-foreground"}`}
                              >
                                {option.isCorrect ? "✓ " : "· "}
                                <MathText text={option.text} />
                                {option.feedback && (
                                  <span className="ml-1 font-normal italic text-muted-foreground">— {option.feedback}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditForm(question)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(question)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => handleTypeChange(v as QuestionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {QUESTION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Puntos</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={form.points}
                  onChange={(e) => setForm((c) => ({ ...c, points: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pregunta</Label>
              <Textarea
                value={form.text}
                onChange={(e) => setForm((c) => ({ ...c, text: e.target.value }))}
                placeholder="¿Cuál es el resultado de...?"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Fórmulas matemáticas: escribe entre signos de dólar, ej. <code>$x^2 + y^2 = z^2$</code>
              </p>
              {form.text.includes("$") && (
                <div className="rounded-md bg-secondary px-3 py-2">
                  <MathText text={form.text} className="text-sm text-foreground" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Imagen (opcional)</Label>
              <FileUploadField value={image} onChange={setImage} accept="image/*" disabled={submitting} />
              {image && <RemoteImage fileKey={image.key} alt={image.name} className="max-h-48 rounded-lg border border-border object-contain" />}
            </div>

            {form.type === "SHORT_ANSWER" ? (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                Las preguntas de respuesta corta se califican manualmente por el profesor.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Opciones — marca la correcta</Label>
                <RadioGroup
                  value={String(form.options.findIndex((o) => o.isCorrect))}
                  onValueChange={(v) => setCorrectOption(Number(v))}
                  className="gap-3"
                >
                  {form.options.map((option, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={String(index)} id={`option-${index}`} />
                        <Input
                          value={option.text}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Opción ${index + 1}`}
                          disabled={form.type === "TRUE_FALSE"}
                          className="flex-1"
                        />
                        {form.type === "MULTIPLE_CHOICE" && form.options.length > 2 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(index)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <Input
                        value={option.feedback}
                        onChange={(e) => updateOptionFeedback(index, e.target.value)}
                        placeholder="Retroalimentación (opcional) — se muestra al estudiante tras enviar"
                        className="ml-6 text-xs"
                      />
                    </div>
                  ))}
                </RadioGroup>
                {form.type === "MULTIPLE_CHOICE" && form.options.length < 10 && (
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addOption}>
                    <Plus className="h-3.5 w-3.5" />
                    Agregar opción
                  </Button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Guardar cambios" : "Agregar pregunta"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
