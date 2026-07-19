"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, BookOpen, FileText, Loader2, MessageSquare, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Homework } from "@/components/profesor/homework-types"
import { DAY_LABELS, type Mark, type Student, type TeacherSchedule } from "@/components/profesor/marks-types"
import { computeWeightedFinal } from "@/lib/grading"
import { ReportCardDialog } from "@/components/shared/report-card-view"

type AcademicYear = { id: string; name: string; isActive: boolean }

function cellKey(studentId: string, homeworkId: string) {
  return `${studentId}:${homeworkId}`
}

function CalificacionesProfesorPageContent() {
  const searchParams = useSearchParams()
  const scheduleIdParam = searchParams.get("scheduleId")

  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [setupError, setSetupError] = useState("")

  const [selectedScheduleId, setSelectedScheduleId] = useState(scheduleIdParam ?? "")
  const [periodFilter, setPeriodFilter] = useState<string>("all")
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYearId, setSelectedYearId] = useState<string>("")
  const [homeworkList, setHomeworkList] = useState<Homework[]>([])
  const [roster, setRoster] = useState<Student[]>([])
  const [marksByCell, setMarksByCell] = useState<Record<string, Mark>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savingCell, setSavingCell] = useState<Record<string, boolean>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [savingComment, setSavingComment] = useState<Record<string, boolean>>({})
  const [openComment, setOpenComment] = useState<string | null>(null)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [gridError, setGridError] = useState("")

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
      setTeacherId(id)

      const [schedulesRes, yearsRes] = await Promise.all([
        apiFetch(`/schedules?teacherId=${id}`, { silent: true }),
        apiFetch("/academic-years", { silent: true }),
      ])
      
      const schedulesData = schedulesRes.ok ? ((await schedulesRes.json()) as TeacherSchedule[]) : []
      setSchedules(schedulesData)
      if (!scheduleIdParam && schedulesData.length > 0) setSelectedScheduleId(schedulesData[0].id)

      if (yearsRes.ok) {
        const years = (await yearsRes.json()) as AcademicYear[]
        setAcademicYears(years)
        const activeYear = years.find((y) => y.isActive)
        if (activeYear) setSelectedYearId(activeYear.id)
        else if (years.length > 0) setSelectedYearId(years[0].id)
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoadingSetup(false)
    }
  }, [])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId) ?? null

  const loadGrid = useCallback(async (schedule: TeacherSchedule, yearId: string) => {
    setLoadingGrid(true)
    setGridError("")
    try {
      const yearQuery = yearId ? `&academicYearId=${yearId}` : ""
      const [homeworkRes, rosterRes, marksRes] = await Promise.all([
        apiFetch(`/homework?groupId=${schedule.group.id}&subjectId=${schedule.subject.id}${yearQuery}`, { silent: true }),
        apiFetch(`/students?groupId=${schedule.group.id}`, { silent: true }),
        apiFetch(`/marks?groupId=${schedule.group.id}&subjectId=${schedule.subject.id}${yearQuery}`, { silent: true }),
      ])

      if (!rosterRes.ok) throw new Error("No se pudo cargar la lista de estudiantes.")

      const homeworkData = homeworkRes.ok ? ((await homeworkRes.json()) as Homework[]) : []
      const rosterData = (await rosterRes.json()) as Student[]
      const marksData = marksRes.ok ? ((await marksRes.json()) as Mark[]) : []

      const sortedHomework = [...homeworkData].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
      setHomeworkList(sortedHomework)
      setRoster(rosterData)

      const byCell: Record<string, Mark> = {}
      const draftValues: Record<string, string> = {}
      for (const mark of marksData) {
        if (!mark.homeworkId) continue
        const key = cellKey(mark.student.id, mark.homeworkId)
        byCell[key] = mark
        draftValues[key] = String(Math.round(mark.value * 100) / 100)
      }
      setMarksByCell(byCell)
      setDraft(draftValues)
    } catch (err) {
      setGridError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setHomeworkList([])
      setRoster([])
    } finally {
      setLoadingGrid(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSchedule && selectedYearId) {
      loadGrid(selectedSchedule, selectedYearId)
    }
  }, [selectedSchedule, selectedYearId, loadGrid])

  const filteredHomeworkList = useMemo(() => {
    if (periodFilter === "all") return homeworkList
    // Antes escondía las tareas SIN nota al filtrar por periodo — justo las que
    // hay que calificar. Ahora una tarea aparece si su nota es de ese periodo o
    // si todavía no tiene nota (sigue disponible para calificar).
    return homeworkList.filter((h) => {
      const anyMark = Object.values(marksByCell).find((m) => m.homework?.id === h.id || m.homeworkId === h.id)
      return !anyMark || String(anyMark.period) === periodFilter
    })
  }, [homeworkList, periodFilter, marksByCell])

  function setCellDraft(studentId: string, homeworkId: string, value: string) {
    setDraft((current) => ({ ...current, [cellKey(studentId, homeworkId)]: value }))
  }

  async function saveCell(studentId: string, homework: Homework) {
    if (!selectedSchedule) return
    const key = cellKey(studentId, homework.id)
    const raw = draft[key] ?? ""
    const existing = marksByCell[key]

    if (raw.trim() === "") {
      return
    }

    const value = Number(raw)
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error("El valor debe estar entre 0 y 100.")
      if (existing) setDraft((c) => ({ ...c, [key]: String(existing.value) }))
      else setDraft((c) => ({ ...c, [key]: "" }))
      return
    }

    if (existing && existing.value === value) return

    setSavingCell((c) => ({ ...c, [key]: true }))
    try {
      const res = existing
        ? await apiFetch(`/marks/${existing.id}`, {
            method: "PATCH",
            body: JSON.stringify({ value }),
            silent: true,
          })
        : await apiFetch("/marks", {
            method: "POST",
            body: JSON.stringify({
              studentId,
              subjectId: selectedSchedule.subject.id,
              homeworkId: homework.id,
              title: homework.title,
              value,
              maxValue: 100,
              // Guarda la nota en el periodo seleccionado (si hay uno), para que
              // el filtro de periodo sea real y no todo caiga en el periodo 1.
              ...(periodFilter !== "all" ? { period: Number(periodFilter) } : {}),
            }),
            silent: true,
          })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la calificación.")
      }

      const saved = (await res.json()) as Mark
      setMarksByCell((c) => ({ ...c, [key]: saved }))
      setDraft((c) => ({ ...c, [key]: String(saved.value) }))
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      })
      if (existing) setDraft((c) => ({ ...c, [key]: String(existing.value) }))
    } finally {
      setSavingCell((c) => ({ ...c, [key]: false }))
    }
  }

  async function saveComment(studentId: string, homework: Homework) {
    const key = cellKey(studentId, homework.id)
    const existing = marksByCell[key]
    if (!existing) return

    const comment = (commentDraft[key] ?? existing.comment ?? "").trim()

    setSavingComment((c) => ({ ...c, [key]: true }))
    try {
      const res = await apiFetch(`/marks/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ comment: comment || null }),
        silent: true,
      })
      if (!res.ok) {
        throw new Error("No se pudo guardar el comentario.")
      }
      const saved = (await res.json()) as Mark
      setMarksByCell((c) => ({ ...c, [key]: saved }))
      toast.success("Comentario guardado")
      setOpenComment(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el comentario.")
    } finally {
      setSavingComment((c) => ({ ...c, [key]: false }))
    }
  }

  // Definitiva de la superficie de edición: fuente única compartida, y respeta
  // el filtro de periodo (antes iteraba la lista sin filtrar).
  function computeFinalGrade(studentId: string) {
    const entries = filteredHomeworkList
      .map((homework) => {
        const mark = marksByCell[cellKey(studentId, homework.id)]
        return mark ? { value: mark.value, maxValue: mark.maxValue, weight: homework.weight } : null
      })
      .filter((e): e is { value: number; maxValue: number; weight: number } => e !== null)
    return computeWeightedFinal(entries)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Calificaciones</h1>
        <p className="mt-1 text-muted-foreground">
          Cada columna es una tarea, ponderada según el % que definiste al crearla.
        </p>
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
          </CardContent>
        </Card>
      )}

      {!loadingSetup && schedules.length > 0 && (
        <>
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end flex-wrap">
              <div className="w-full space-y-2 sm:w-48">
                <Label>Año Lectivo</Label>
                <Select value={selectedYearId} onValueChange={setSelectedYearId} disabled={loadingSetup}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name} {y.isActive ? "(Activo)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-2 sm:w-64">
                <Label>Clase</Label>
                <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId} disabled={loadingSetup}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSetup ? "Cargando..." : "Selecciona una clase"} />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {DAY_LABELS[schedule.dayOfWeek]} {schedule.startTime}-{schedule.endTime} · {schedule.group.name} ·{" "}
                        {schedule.subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-2 sm:w-48">
                <Label>Periodo / Nota Final</Label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Nota Final (Todos)</SelectItem>
                    {[1, 2, 3, 4].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        Periodo {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-auto ml-auto">
                <Button variant="outline" asChild className="w-full">
                  <Link href={`/profesor/asignaciones${selectedScheduleId ? `?scheduleId=${selectedScheduleId}` : ""}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Gestionar asignaciones
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {gridError && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{gridError}</p>
            </div>
          )}

          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>
                {selectedSchedule ? `${selectedSchedule.group.name} · ${selectedSchedule.subject.name}` : "Notas"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {filteredHomeworkList.length} tarea{filteredHomeworkList.length !== 1 && "s"} · peso total{" "}
                {filteredHomeworkList.reduce((acc, h) => acc + h.weight, 0)}%{" "}
                {filteredHomeworkList.reduce((acc, h) => acc + h.weight, 0) !== 100 && (
                  <span className="text-amber-600">(debería sumar 100%)</span>
                )}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {loadingGrid ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-10 animate-pulse rounded-lg bg-secondary" />
                  ))}
                </div>
              ) : filteredHomeworkList.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <h2 className="mt-3 text-base font-semibold text-foreground">Aún no hay asignaciones para esta clase</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crea asignaciones primero para poder calificar por columna.
                  </p>
                  <Button className="mt-4 gap-2" asChild>
                    <Link href={`/profesor/asignaciones${selectedScheduleId ? `?scheduleId=${selectedScheduleId}` : ""}`}>
                      <FileText className="h-4 w-4" />
                      Ir a Asignaciones
                    </Link>
                  </Button>
                </div>
              ) : roster.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <p className="text-sm text-muted-foreground">Este grupo no tiene estudiantes activos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="sticky left-0 bg-background px-4 py-3 text-left font-medium text-muted-foreground z-10 border-r border-border min-w-[200px]">
                          Estudiante
                        </th>
                        {filteredHomeworkList.map((homework) => (
                          <th key={homework.id} className="min-w-[140px] px-3 py-3 text-center font-medium text-muted-foreground">
                            <p className="truncate" title={homework.title}>
                              {homework.title}
                            </p>
                            <Badge variant="outline" className="mt-1 font-normal">
                              {homework.weight}%
                            </Badge>
                          </th>
                        ))}
                        <th className="min-w-[120px] px-4 py-3 text-center font-medium text-muted-foreground">
                          Nota final
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((student) => {
                        const finalGrade = computeFinalGrade(student.id)
                        return (
                          <tr key={student.id} className="border-b border-border">
                            <td className="sticky left-0 bg-background px-4 py-4 border-r border-border min-w-[200px]">
                              <p className="font-medium text-foreground">
                                {student.firstName} {student.lastName}
                              </p>
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">{student.documentId}</p>
                                <ReportCardDialog
                                  studentId={student.id}
                                  studentName={`${student.firstName} ${student.lastName}`}
                                />
                              </div>
                            </td>
                            {filteredHomeworkList.map((homework) => {
                              const key = cellKey(student.id, homework.id)
                              const existingMark = marksByCell[key]
                              return (
                                <td key={homework.id} className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <div className="relative w-20">
                                      <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={draft[key] ?? ""}
                                        onChange={(event) => setCellDraft(student.id, homework.id, event.target.value)}
                                        onBlur={() => saveCell(student.id, homework)}
                                        placeholder="—"
                                        className="h-8 text-center"
                                        disabled={savingCell[key]}
                                      />
                                      {savingCell[key] && (
                                        <Loader2 className="absolute -right-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                                      )}
                                    </div>
                                    {existingMark && (
                                      <Popover
                                        open={openComment === key}
                                        onOpenChange={(open) => {
                                          setOpenComment(open ? key : null)
                                          if (open) setCommentDraft((c) => ({ ...c, [key]: existingMark.comment ?? "" }))
                                        }}
                                      >
                                        <PopoverTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0"
                                            title={existingMark.comment ? "Ver/editar comentario" : "Agregar comentario"}
                                          >
                                            <MessageSquare
                                              className={`h-3.5 w-3.5 ${existingMark.comment ? "text-foreground" : "text-muted-foreground"}`}
                                            />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 space-y-2">
                                          <Label className="text-xs">Comentario para el estudiante</Label>
                                          <Textarea
                                            value={commentDraft[key] ?? ""}
                                            onChange={(e) => setCommentDraft((c) => ({ ...c, [key]: e.target.value }))}
                                            placeholder="Retroalimentación opcional..."
                                            rows={3}
                                          />
                                          <div className="flex justify-end">
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={() => saveComment(student.id, homework)}
                                              disabled={savingComment[key]}
                                            >
                                              {savingComment[key] && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                                              Guardar
                                            </Button>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                            <td className="px-4 py-2 text-center">
                              {finalGrade.percent !== null ? (
                                <Badge variant={finalGrade.gradedCount === filteredHomeworkList.length ? "default" : "outline"}>
                                  {finalGrade.percent.toFixed(1)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default function CalificacionesProfesorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
          <div className="h-64 animate-pulse rounded-lg bg-secondary" />
        </div>
      }
    >
      <CalificacionesProfesorPageContent />
    </Suspense>
  )
}
