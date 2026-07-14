"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, CalendarClock, ChevronLeft, Loader2, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AttachmentPreviewDialog } from "@/components/shared/attachment-preview-dialog"
import { FileUploadField, type UploadedFileValue } from "@/components/shared/file-upload-field"
import { Label } from "@/components/ui/label"
import { MathText } from "@/components/shared/math-text"
import {
  HOMEWORK_TYPE_COLORS,
  HOMEWORK_TYPE_LABELS,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
  type Homework,
  type HomeworkSubmission,
} from "@/components/profesor/homework-types"

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AlumnoTareaPage() {
  const params = useParams<{ homeworkId: string }>()
  const router = useRouter()
  const homeworkId = params.homeworkId

  const [homework, setHomework] = useState<Homework | null>(null)
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attachment, setAttachment] = useState<UploadedFileValue>(null)
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<{ key: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [homeworkRes, submissionRes] = await Promise.all([
        apiFetch(`/homework/${homeworkId}`, { silent: true }),
        apiFetch(`/homework/${homeworkId}/submissions/me`, { silent: true }),
      ])
      if (!homeworkRes.ok) throw new Error("No se pudo cargar la asignación.")
      setHomework((await homeworkRes.json()) as Homework)

      if (submissionRes.ok) {
        const text = await submissionRes.text()
        setSubmission(text ? (JSON.parse(text) as HomeworkSubmission) : null)
      } else {
        setSubmission(null)
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

  function openAttachment(key: string, name?: string | null) {
    setPreview({ key, name: name ?? "Archivo" })
  }

  async function handleSubmit() {
    if (!attachment) {
      toast.error("Adjunta un archivo antes de entregar.")
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch(`/homework/${homeworkId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ attachmentKey: attachment.key, attachmentName: attachment.name }),
        silent: true,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo entregar la tarea.")
      }
      const saved = (await res.json()) as HomeworkSubmission
      setSubmission(saved)
      setAttachment(null)
      toast.success("Entrega enviada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo entregar la tarea.")
    } finally {
      setSubmitting(false)
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

  const now = new Date()
  const isOverdue = new Date(homework.dueDate) < now && !submission
  const notYetOpen = homework.availableFrom && new Date(homework.availableFrom) > now
  const closed = homework.cutOffDate && new Date(homework.cutOffDate) < now

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => router.push("/alumno/asignaciones")}>
        <ChevronLeft className="h-4 w-4" />
        Volver a asignaciones
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{homework.title}</CardTitle>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HOMEWORK_TYPE_COLORS[homework.type]}`}>
              {HOMEWORK_TYPE_LABELS[homework.type]}
            </span>
            {isOverdue && <Badge className="bg-red-100 text-red-700">Atrasado</Badge>}
          </div>
          <p className={`flex items-center gap-1 text-xs ${isOverdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
            <CalendarClock className="h-3.5 w-3.5" />
            Entrega: {formatDate(homework.dueDate)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {homework.description && <MathText text={homework.description} className="text-sm text-foreground" />}

          {homework.attachmentKey && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAttachment(homework.attachmentKey!, homework.attachmentName)}>
              <Paperclip className="h-3.5 w-3.5" />
              Ver material del profesor
            </Button>
          )}

          <div className="border-t border-border pt-4">
            {submission ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={SUBMISSION_STATUS_COLORS[submission.status]} variant="outline">
                    {SUBMISSION_STATUS_LABELS[submission.status]}
                  </Badge>
                  {submission.submittedAt && (
                    <span className="text-xs text-muted-foreground">Entregado: {formatDate(submission.submittedAt)}</span>
                  )}
                </div>
                {submission.attachmentKey && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAttachment(submission.attachmentKey!, submission.attachmentName)}>
                    <Paperclip className="h-3.5 w-3.5" />
                    Ver mi entrega
                  </Button>
                )}
                {submission.status === "GRADED" && submission.feedbackComment && (
                  <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Retroalimentación del profesor</p>
                    {submission.feedbackComment}
                  </div>
                )}
                {!closed && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground">¿Necesitas corregir? Sube un nuevo archivo para reemplazar tu entrega.</p>
                    <FileUploadField value={attachment} onChange={setAttachment} disabled={submitting} />
                    {attachment && (
                      <Button onClick={handleSubmit} disabled={submitting} size="sm">
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reemplazar entrega
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : notYetOpen ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                Esta asignación aún no está disponible para entregar.
              </p>
            ) : closed ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                El plazo de entrega para esta asignación ya cerró.
              </p>
            ) : (
              <div className="space-y-3">
                <Label>Tu entrega</Label>
                <FileUploadField value={attachment} onChange={setAttachment} disabled={submitting} />
                <Button onClick={handleSubmit} disabled={submitting || !attachment}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entregar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AttachmentPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
        fileKey={preview?.key ?? null}
        fileName={preview?.name}
      />
    </div>
  )
}
