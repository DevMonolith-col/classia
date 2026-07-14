"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, FileText, PenSquare, Paperclip } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssignmentCard } from "@/components/shared/assignment-card"
import { AttachmentPreviewDialog } from "@/components/shared/attachment-preview-dialog"
import {
  HOMEWORK_TYPE_COLORS,
  HOMEWORK_TYPE_LABELS,
  HOMEWORK_TYPES,
  type Homework,
  type HomeworkType,
} from "@/components/profesor/homework-types"

const FILTERS = ["ALL", ...HOMEWORK_TYPES] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  ALL: "Todas",
  TAREA: "Tareas",
  EXAMEN: "Exámenes",
  QUIZ: "Quices",
  PROYECTO: "Proyectos",
}

const QUIZ_LIKE_TYPES = new Set<HomeworkType>(["QUIZ", "EXAMEN"])

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AlumnoAsignacionesPage() {
  const router = useRouter()
  const [homeworkList, setHomeworkList] = useState<Homework[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<Filter>("ALL")
  const [preview, setPreview] = useState<{ key: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/homework", { silent: true })
      if (!res.ok) throw new Error("No se pudo cargar tus asignaciones.")
      setHomeworkList((await res.json()) as Homework[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const filtered = filter === "ALL" ? homeworkList : homeworkList.filter((h) => h.type === filter)
    return [...filtered].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [homeworkList, filter])

  function openAttachment(key: string, name?: string | null) {
    setPreview({ key, name: name ?? "Archivo" })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asignaciones</h1>
        <p className="mt-1 text-muted-foreground">Tareas, exámenes y quices de tus clases.</p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader className="gap-3 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              {FILTER_LABELS[filter]} ({visible.length})
            </CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                {FILTERS.map((f) => (
                  <TabsTrigger key={f} value={f}>
                    {FILTER_LABELS[f]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No hay nada por aquí.</p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {visible.map((homework) => (
                <AssignmentCard
                  key={homework.id}
                  homework={homework}
                  onAttachmentClick={openAttachment}
                  actionButton={
                    QUIZ_LIKE_TYPES.has(homework.type) ? (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => router.push(`/alumno/quiz/${homework.id}`)}
                      >
                        <PenSquare className="h-3.5 w-3.5" />
                        {homework.type === "EXAMEN" ? "Presentar examen" : "Realizar quiz"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => router.push(`/alumno/tarea/${homework.id}`)}
                      >
                        <PenSquare className="h-3.5 w-3.5" />
                        Entregar
                      </Button>
                    )
                  }
                />
              ))}
            </div>
          )}
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
