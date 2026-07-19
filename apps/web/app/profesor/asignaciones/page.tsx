"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssignmentCard } from "@/components/shared/assignment-card"
import { AttachmentPreviewDialog } from "@/components/shared/attachment-preview-dialog"
import { HOMEWORK_TYPES, type Homework } from "@/components/profesor/homework-types"
import { DAY_LABELS, type TeacherSchedule } from "@/components/profesor/marks-types"

const FILTERS = ["ALL", ...HOMEWORK_TYPES] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  ALL: "Todas",
  TAREA: "Tareas",
  EXAMEN: "Exámenes",
  QUIZ: "Quices",
  PROYECTO: "Proyectos",
}

const PAGE_SIZE = 5

function AsignacionesProfesorPageContent() {
  const searchParams = useSearchParams()
  const scheduleIdParam = searchParams.get("scheduleId")

  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [setupError, setSetupError] = useState("")

  const [selectedScheduleId, setSelectedScheduleId] = useState(scheduleIdParam ?? "")
  const [homeworkList, setHomeworkList] = useState<Homework[]>([])
  const [loadingHomework, setLoadingHomework] = useState(false)
  const [filter, setFilter] = useState<Filter>("ALL")
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<{ key: string; name: string } | null>(null)

  const loadSetup = useCallback(async () => {
    setLoadingSetup(true)
    setSetupError("")
    try {
      const bootstrapRes = await apiFetch("/app/bootstrap", { silent: true })
      if (!bootstrapRes.ok) throw new Error("No se pudo cargar tu perfil de profesor.")
      const bootstrap = (await bootstrapRes.json()) as {
        summary?: { kind?: string; teacher?: { id?: string } }
      }
      const id = bootstrap.summary?.teacher?.id
      if (!bootstrap.summary || bootstrap.summary.kind !== "teacher" || !id) {
        throw new Error("Esta cuenta no tiene un perfil de profesor asociado.")
      }

      const schedulesRes = await apiFetch(`/schedules?teacherId=${id}`, { silent: true })
      const schedulesData = schedulesRes.ok ? ((await schedulesRes.json()) as TeacherSchedule[]) : []
      setSchedules(schedulesData)
      if (!scheduleIdParam && schedulesData.length > 0) setSelectedScheduleId(schedulesData[0].id)
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoadingSetup(false)
    }
  }, [scheduleIdParam])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId) ?? null

  const loadHomework = useCallback(async (schedule: TeacherSchedule) => {
    setLoadingHomework(true)
    try {
      const res = await apiFetch(`/homework?groupId=${schedule.group.id}&subjectId=${schedule.subject.id}`, {
        silent: true,
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as Homework[]
      setHomeworkList(data)
    } catch {
      setHomeworkList([])
    } finally {
      setLoadingHomework(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSchedule) loadHomework(selectedSchedule)
  }, [selectedSchedule, loadHomework])

  const visibleHomework = useMemo(() => {
    const filtered = filter === "ALL" ? homeworkList : homeworkList.filter((h) => h.type === filter)
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [homeworkList, filter])

  const pageCount = Math.max(1, Math.ceil(visibleHomework.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginatedHomework = visibleHomework.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [selectedScheduleId, filter])

  function openAttachment(key: string, name?: string | null) {
    setPreview({ key, name: name ?? "Archivo" })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asignaciones</h1>
          <p className="mt-1 text-muted-foreground">Crea y gestiona las tareas, exámenes y quices de tus clases.</p>
        </div>
        {selectedSchedule ? (
          <Button className="gap-2" asChild>
            <Link href={`/profesor/asignaciones/nueva?scheduleId=${selectedScheduleId}`}>
              <Plus className="h-4 w-4" />
              Nueva asignación
            </Link>
          </Button>
        ) : (
          <Button className="gap-2" disabled>
            <Plus className="h-4 w-4" />
            Nueva asignación
          </Button>
        )}
      </div>

      {setupError && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{setupError}</p>
        </div>
      )}

      {!loadingSetup && !setupError && schedules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-base font-semibold text-foreground">Aún no tienes clases asignadas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pide a la administración que te asigne horarios para poder crear asignaciones.
            </p>
          </CardContent>
        </Card>
      )}

      {!loadingSetup && schedules.length > 0 && (
        <>
          <Card className="mb-6">
            <CardHeader className="flex flex-col gap-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>
                {FILTER_LABELS[filter]} ({visibleHomework.length})
              </CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-full sm:min-w-[300px] sm:max-w-md">
                  <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Clase" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedules.map((schedule) => (
                        <SelectItem key={schedule.id} value={schedule.id}>
                          {DAY_LABELS[schedule.dayOfWeek]} {schedule.startTime}-{schedule.endTime} ·{" "}
                          {schedule.group.name} · {schedule.subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
            <CardContent className="pt-4">
              {loadingHomework ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-40 animate-pulse rounded-lg bg-secondary" />
                  ))}
                </div>
              ) : visibleHomework.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <h2 className="mt-3 text-base font-semibold text-foreground">
                    {homeworkList.length === 0 ? "Aún no hay asignaciones para esta clase" : "No hay nada en esta categoría"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {homeworkList.length === 0 ? "Crea la primera con el botón de arriba." : "Prueba con otro filtro."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {paginatedHomework.map((homework) => (
                      <AssignmentCard
                        key={homework.id}
                        homework={homework}
                        editHref={`/profesor/asignaciones/${homework.id}`}
                        onAttachmentClick={openAttachment}
                      />
                    ))}
                  </div>

                  {pageCount > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                      <p className="text-sm text-muted-foreground">
                        Página {currentPage} de {pageCount}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                          disabled={currentPage >= pageCount}
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AttachmentPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
        fileKey={preview?.key ?? null}
        fileName={preview?.name}
      />
    </div>
  )
}

export default function AsignacionesProfesorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
          <div className="h-64 animate-pulse rounded-lg bg-secondary" />
        </div>
      }
    >
      <AsignacionesProfesorPageContent />
    </Suspense>
  )
}
