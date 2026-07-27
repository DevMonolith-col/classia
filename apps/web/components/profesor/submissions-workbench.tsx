"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  NOT_SUBMITTED_COLOR,
  NOT_SUBMITTED_LABEL,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
  type Homework,
  type RosterEntry,
} from "./homework-types"

// Mismo tratamiento que AttachmentPreviewDialog: pdfjs no puede renderizar en el servidor.
// Ese diálogo NO se toca -- lo sigue usando el resto de la app; acá se usa el visor directo,
// que es justamente lo que evita la pantalla completa para volver a la lista.
const PdfViewer = dynamic(() => import("@/components/shared/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

type FilterKey = "all" | "ungraded" | "missing" | "graded"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "ungraded", label: "Por calificar" },
  { key: "missing", label: "Sin entregar" },
  { key: "graded", label: "Calificados" },
]

/** En móvil no caben tres columnas en 375px, así que se navega de panel en panel. */
type Pane = "list" | "doc" | "grade"

function matchesFilter(entry: RosterEntry, filter: FilterKey) {
  switch (filter) {
    case "ungraded":
      return entry.submission !== null && entry.mark === null
    case "missing":
      return entry.submission === null
    case "graded":
      return entry.mark !== null
    case "all":
      return true
  }
}

export function SubmissionsWorkbench({ homework }: { homework: Homework }) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [pane, setPane] = useState<Pane>("list")

  const [value, setValue] = useState("")
  const [maxValue, setMaxValue] = useState("100")
  const [feedbackComment, setFeedbackComment] = useState("")

  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/homework/${homework.id}/submissions`, { silent: true })
      if (!res.ok) throw new Error("No se pudo cargar el listado de estudiantes.")
      const data = (await res.json()) as RosterEntry[]
      setRoster(data)
      setSelectedId((current) => current ?? data[0]?.student.id ?? null)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar.")
      return [] as RosterEntry[]
    } finally {
      setLoading(false)
    }
  }, [homework.id])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => roster.filter((e) => matchesFilter(e, filter)), [roster, filter])
  const selected = useMemo(
    () => roster.find((e) => e.student.id === selectedId) ?? null,
    [roster, selectedId],
  )

  // El formulario refleja al alumno seleccionado, incluida su nota vigente. Precargar 100 acá
  // sería reintroducir la pérdida de datos que la Fase 1 arregló.
  useEffect(() => {
    if (!selected) return
    setValue(selected.mark ? String(selected.mark.value) : "")
    setMaxValue(String(selected.mark?.maxValue ?? 100))
    setFeedbackComment(selected.submission?.feedbackComment ?? "")
  }, [selected])

  const attachmentKey = selected?.submission?.attachmentKey ?? null
  const attachmentName = selected?.submission?.attachmentName ?? null
  const isPdf = (attachmentName ?? "").toLowerCase().endsWith(".pdf")

  useEffect(() => {
    if (!attachmentKey) {
      setFileUrl(null)
      return
    }

    let cancelled = false
    setFileLoading(true)
    setFileUrl(null)

    apiFetch(`/files/url?key=${encodeURIComponent(attachmentKey)}`, { silent: true })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data = (await res.json()) as { url: string }
        if (!cancelled) setFileUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo abrir el archivo entregado.")
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [attachmentKey])

  function selectStudent(studentId: string) {
    setSelectedId(studentId)
    setPane("doc")
  }

  /**
   * Guarda y, si se pidió, salta al siguiente **sin calificar**. Ese salto es el único atajo
   * que de verdad ahorra trabajo: sin él hay que volver a la lista, buscar dónde iba y volver
   * a entrar, que es la fricción que este panel existe para eliminar.
   */
  async function save({ advance }: { advance: boolean }) {
    if (!selected) return

    const numericValue = Number(value)
    const numericMaxValue = Number(maxValue)
    // `Number("")` es 0, no NaN: sin el trim, dejar el campo vacío guardaba un cero.
    if (
      value.trim() === "" ||
      Number.isNaN(numericValue) ||
      Number.isNaN(numericMaxValue) ||
      numericValue > numericMaxValue
    ) {
      toast.error("La nota debe ser un número válido y no superar el máximo.")
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch(
        `/homework/${homework.id}/submissions/by-student/${selected.student.id}/grade`,
        {
          method: "PATCH",
          body: JSON.stringify({
            value: numericValue,
            maxValue: numericMaxValue,
            feedbackComment: feedbackComment.trim() || undefined,
          }),
          silent: true,
        },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la calificación.")
      }

      const fresh = await load()
      toast.success(`Nota guardada para ${selected.student.firstName}`)

      if (advance) {
        const pool = fresh.filter((e) => matchesFilter(e, filter))
        const from = pool.findIndex((e) => e.student.id === selected.student.id)
        // Circular y arrancando después del actual: en la lista completa el siguiente sin
        // calificar puede haber quedado atrás.
        const next =
          pool.slice(from + 1).find((e) => e.mark === null) ??
          pool.slice(0, Math.max(from, 0)).find((e) => e.mark === null)

        if (next) {
          setSelectedId(next.student.id)
        } else {
          toast.success("No queda nadie sin calificar.")
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la calificación.")
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = roster.filter((e) => e.mark === null).length

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="h-[70vh] animate-pulse rounded-lg bg-secondary" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:h-screen">
      {/* Encabezado */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/profesor/asignaciones/${homework.id}`} aria-label="Volver a la asignación">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{homework.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {homework.subject.name} · {homework.group.name}
            </p>
          </div>
        </div>
        <Badge variant={pendingCount > 0 ? "outline" : "secondary"}>
          {pendingCount === 0 ? "Todo calificado" : `${pendingCount} sin calificar`}
        </Badge>
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Navegación entre paneles, solo en móvil */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2 lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          disabled={pane === "list"}
          onClick={() => setPane(pane === "grade" ? "doc" : "list")}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {pane === "grade" ? "Documento" : "Estudiantes"}
        </Button>
        <span className="text-sm font-medium text-foreground">
          {pane === "list" ? "Estudiantes" : pane === "doc" ? "Entrega" : "Calificación"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={pane === "grade" || !selected}
          onClick={() => setPane(pane === "list" ? "doc" : "grade")}
        >
          {pane === "list" ? "Entrega" : "Calificar"}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_1fr_20rem]">
        {/* Panel 1 — estudiantes */}
        <aside
          className={`min-h-0 flex-col border-border lg:flex lg:border-r ${
            pane === "list" ? "flex" : "hidden"
          }`}
        >
          <div className="shrink-0 border-b border-border p-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <TabsList className="w-full">
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.key} value={f.key} className="flex-1 text-xs">
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Scroll con la lista completa, sin paginar a 5 como el resto de los listados: esto
              es navegación dentro de una herramienta, no un browse. Paginar un curso de 35
              reintroduce la fricción que este panel existe para quitar. Desviación consciente
              del estándar de f11026a. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Nadie coincide con este filtro.
              </p>
            ) : (
              visible.map((entry) => {
                const isSelected = entry.student.id === selectedId
                return (
                  <button
                    key={entry.student.id}
                    onClick={() => selectStudent(entry.student.id)}
                    className={`flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        entry.mark ? "bg-success" : entry.submission ? "bg-blue-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {entry.student.firstName} {entry.student.lastName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.submission
                          ? SUBMISSION_STATUS_LABELS[entry.submission.status] ?? entry.submission.status
                          : NOT_SUBMITTED_LABEL}
                        {!entry.inGroup && " · fuera del curso"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {entry.mark ? entry.mark.value : "—"}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Panel 2 — documento entregado */}
        <section
          className={`min-h-0 flex-col bg-muted/30 lg:flex ${pane === "doc" ? "flex" : "hidden"}`}
        >
          {!selected ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Elige un estudiante para ver su entrega.
            </div>
          ) : !attachmentKey ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-foreground">Sin archivo entregado</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {selected.submission
                  ? "La entrega existe pero no tiene archivo adjunto."
                  : "Este estudiante no entregó. Se le puede calificar igual."}
              </p>
            </div>
          ) : fileLoading || !fileUrl ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isPdf ? (
            <PdfViewer url={fileUrl} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                La vista previa dentro de la plataforma solo está disponible para PDF.
              </p>
              <Button asChild size="sm" className="gap-1.5">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir {attachmentName ?? "archivo"}
                </a>
              </Button>
            </div>
          )}
        </section>

        {/* Panel 3 — calificación */}
        <aside
          className={`min-h-0 flex-col border-border lg:flex lg:border-l ${
            pane === "grade" ? "flex" : "hidden"
          }`}
        >
          {!selected ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Elige un estudiante para calificar.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-border px-4 py-3">
                <p className="font-medium text-foreground">
                  {selected.student.firstName} {selected.student.lastName}
                </p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${
                    selected.submission
                      ? SUBMISSION_STATUS_COLORS[selected.submission.status] ?? NOT_SUBMITTED_COLOR
                      : NOT_SUBMITTED_COLOR
                  }`}
                >
                  {selected.submission
                    ? SUBMISSION_STATUS_LABELS[selected.submission.status] ?? selected.submission.status
                    : NOT_SUBMITTED_LABEL}
                </Badge>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {!selected.submission && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    No entregó. Al guardar, la nota se registra igual y la entrega queda sin
                    archivo.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nota</Label>
                    <Input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máximo</Label>
                    <Input
                      type="number"
                      min={1}
                      value={maxValue}
                      onChange={(e) => setMaxValue(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Comentario (opcional)</Label>
                  <Textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Retroalimentación para el estudiante..."
                    rows={5}
                  />
                </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-border p-4">
                <Button
                  className="w-full gap-2"
                  onClick={() => save({ advance: true })}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Guardar y siguiente
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => save({ advance: false })}
                  disabled={saving}
                >
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
