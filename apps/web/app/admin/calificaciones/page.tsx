"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, FileText, Loader2, Users } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { computeWeightedFinal } from "@/lib/grading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StudentCombobox, type StudentOption } from "@/components/admin/student-combobox"
import type { Mark } from "@/components/admin/marks-types"

const PERIOD_OPTIONS = [1, 2, 3, 4]
const PAGE_SIZE = 10

type Group = { id: string; name: string; grade: string; section: string }
type AcademicYear = {
  id: string
  name: string
  isActive: boolean
  periods?: { id: string; sequence: number; name: string }[]
}

// Respuesta de /report-cards/preview: la definitiva oficial del motor del backend.
type SummaryLine = {
  subjectId: string
  subjectName: string
  final: number | null
  label: string | null
  passing: boolean | null
}
type StudentSummary = {
  scaleName: string
  passingValue: number
  overallAverage: number | null
  lines: SummaryLine[]
}

export default function AdminCalificacionesPage() {
  const [marks, setMarks] = useState<Mark[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedYearId, setSelectedYearId] = useState<string>("")
  const [selectedGroupId, setSelectedGroupId] = useState<string>("ALL")
  const [periodFilter, setPeriodFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  // Vista estudiante-céntrica: el boletín es DEL estudiante. Con estudiante
  // seleccionado se muestra su resumen por materias (definitiva oficial del
  // motor) y cada materia se expande para ver el desarrollo (notas sueltas).
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [summary, setSummary] = useState<StudentSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null)

  const loadBaseData = useCallback(async () => {
    try {
      const [groupsRes, yearsRes, studentsRes] = await Promise.all([
        apiFetch("/groups", { silent: true }),
        apiFetch("/academic-years", { silent: true }),
        apiFetch("/students", { silent: true }),
      ])

      setGroups(groupsRes.ok ? (((await groupsRes.json()) as Group[]) ?? []) : [])
      if (studentsRes.ok) {
        const data = (await studentsRes.json()) as { id: string; firstName: string; lastName: string; documentId?: string | null; group?: { id: string } | null }[]
        setStudents(data.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, documentId: s.documentId, groupId: s.group?.id ?? null })))
      }
      
      if (yearsRes.ok) {
        const years = (await yearsRes.json()) as AcademicYear[]
        setAcademicYears(years)
        const activeYear = years.find((y) => y.isActive)
        if (activeYear) {
          setSelectedYearId(activeYear.id)
        } else if (years.length > 0) {
          setSelectedYearId(years[0].id)
        }
      }
    } catch (err) {
      console.error("Error loading base data", err)
    }
  }, [])

  const loadMarks = useCallback(async (yearId: string) => {
    setLoading(true)
    setError("")
    try {
      const marksRes = await apiFetch(`/marks?academicYearId=${yearId}`, { silent: true })

      if (!marksRes.ok) {
        throw new Error(marksRes.status === 403 ? "No tienes permiso para ver las calificaciones." : "No se pudo cargar las calificaciones.")
      }

      setMarks(((await marksRes.json()) as Mark[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setMarks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBaseData()
  }, [loadBaseData])

  useEffect(() => {
    if (selectedYearId) {
      loadMarks(selectedYearId)
    }
  }, [selectedYearId, loadMarks])

  // Estudiantes disponibles en el combobox, acotados al curso elegido.
  const studentsForCombobox = useMemo(() => {
    const list = selectedGroupId !== "ALL" ? students.filter((s) => s.groupId === selectedGroupId) : students
    return [...list].sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
  }, [students, selectedGroupId])

  // Si cambia el curso y el estudiante elegido no pertenece, se deselecciona.
  useEffect(() => {
    if (selectedStudentId && selectedGroupId !== "ALL") {
      const stillVisible = students.some((s) => s.id === selectedStudentId && s.groupId === selectedGroupId)
      if (!stillVisible) setSelectedStudentId(null)
    }
  }, [selectedGroupId, selectedStudentId, students])

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null

  // Resumen oficial (motor del backend): definitiva + banda por materia, del
  // periodo elegido o del año completo si el filtro está en "Nota Final".
  useEffect(() => {
    if (!selectedStudentId || !selectedYearId) {
      setSummary(null)
      return
    }
    let cancelled = false
    async function load() {
      setSummaryLoading(true)
      try {
        const year = academicYears.find((y) => y.id === selectedYearId)
        const periodId =
          periodFilter !== "all" ? year?.periods?.find((p) => p.sequence === Number(periodFilter))?.id : undefined
        const qs = new URLSearchParams({ studentId: selectedStudentId as string, academicYearId: selectedYearId })
        if (periodId) qs.set("periodId", periodId)
        const res = await apiFetch(`/report-cards/preview?${qs.toString()}`, { silent: true })
        if (!res.ok) throw new Error()
        const data = (await res.json()) as StudentSummary
        if (!cancelled) setSummary(data)
      } catch {
        if (!cancelled) setSummary(null)
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedStudentId, selectedYearId, periodFilter, academicYears])

  // Desarrollo de una materia: las notas individuales del estudiante en el año
  // (y periodo, si hay filtro), agrupadas desde las marks ya cargadas.
  const marksForSubject = useCallback(
    (subjectId: string) => {
      if (!selectedStudentId) return []
      return marks
        .filter(
          (m) =>
            m.student.id === selectedStudentId &&
            m.subject.id === subjectId &&
            (periodFilter === "all" || String(m.period) === periodFilter),
        )
        .sort((a, b) => a.period - b.period || (a.date < b.date ? -1 : 1))
    },
    [marks, selectedStudentId, periodFilter],
  )



  const filteredMarks = useMemo(() => {
    let list = marks
    if (selectedGroupId !== "ALL") list = list.filter((m) => m.student.groupId === selectedGroupId)
    if (periodFilter !== "all") list = list.filter((m) => String(m.period) === periodFilter)
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [marks, selectedGroupId, periodFilter])

  // Materias del consolidado: columnas derivadas de las notas del curso elegido.
  const subjectsToDisplay = useMemo(() => {
    let list = marks
    if (selectedGroupId !== "ALL") list = list.filter((m) => m.student.groupId === selectedGroupId)
    const map = new Map<string, { id: string; name: string }>()
    list.forEach((m) => map.set(m.subject.id, { id: m.subject.id, name: m.subject.name }))
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [marks, selectedGroupId])

  const uniqueStudents = useMemo(() => {
    const map = new Map<string, typeof marks[0]['student']>()
    for (const mark of filteredMarks) {
      if (!map.has(mark.student.id)) {
        map.set(mark.student.id, mark.student)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.firstName.localeCompare(b.firstName))
  }, [filteredMarks])

  const pageCount = Math.max(1, Math.ceil(uniqueStudents.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginatedStudents = uniqueStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [selectedGroupId, periodFilter, selectedYearId])

  const getStudentGradeForSubject = useCallback((studentId: string, subjectId: string) => {
    const studentMarks = filteredMarks.filter(m => m.student.id === studentId && m.subject.id === subjectId)
    const entries = studentMarks.map(m => ({
      value: m.value,
      maxValue: m.maxValue,
      weight: m.homework?.weight ?? 0
    }))
    return computeWeightedFinal(entries)
  }, [filteredMarks])

  const isConsolidadoView = selectedGroupId !== "ALL"

  const [generatingBulk, setGeneratingBulk] = useState(false)

  // Emite (congela) los boletines del filtro actual: curso o colegio completo,
  // del periodo seleccionado o del año si el filtro está en "Nota Final".
  async function generateBulkReportCards() {
    setGeneratingBulk(true)
    try {
      const selectedYear = academicYears.find((y) => y.id === selectedYearId)
      const periodId =
        periodFilter !== "all"
          ? selectedYear?.periods?.find((p) => p.sequence === Number(periodFilter))?.id
          : undefined

      const res = await apiFetch("/report-cards/generate-bulk", {
        method: "POST",
        body: JSON.stringify({
          ...(selectedGroupId !== "ALL" ? { groupId: selectedGroupId } : {}),
          ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
          ...(periodId ? { periodId } : {}),
        }),
        silent: true,
      })
      if (!res.ok) throw new Error("No se pudieron generar los boletines.")
      const summary = (await res.json()) as {
        total: number
        generated: number
        skipped: { studentName: string; reason: string }[]
      }
      if (summary.skipped.length > 0) {
        toast.warning(`${summary.generated} de ${summary.total} boletines generados`, {
          description: `Omitidos: ${summary.skipped.map((s) => s.studentName).join(", ")}`,
        })
      } else {
        toast.success(`${summary.generated} boletines generados`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron generar los boletines.")
    } finally {
      setGeneratingBulk(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Calificaciones</h1>
        <p className="mt-1 text-muted-foreground">Consulta y ajusta las calificaciones registradas por los profesores.</p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border">
          {/* El boletín es del estudiante: su búsqueda es el control principal. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:max-w-md sm:flex-1">
              <Label>Estudiante</Label>
              <StudentCombobox
                students={studentsForCombobox}
                value={selectedStudentId}
                onChange={setSelectedStudentId}
                allowAll
              />
            </div>
            <div className="w-full space-y-2 sm:w-56">
              <Label>Grado / Curso</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los cursos</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:ml-auto sm:w-auto">
              <Button onClick={generateBulkReportCards} disabled={generatingBulk || !selectedYearId} className="w-full gap-2">
                {generatingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generar boletines
              </Button>
            </div>
          </div>
          {/* Contexto académico: qué año y qué corte estás mirando. */}
          <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:w-48">
              <Label>Año Lectivo</Label>
              <Select value={selectedYearId} onValueChange={setSelectedYearId}>
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
            <div className="w-full space-y-2 sm:w-48">
              <Label>Periodo / Nota Final</Label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Nota Final (Todos)</SelectItem>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      Periodo {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {selectedStudent ? (
            <>
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedStudent.documentId ?? "Sin documento"}
                    {summary && ` · ${summary.scaleName}`}
                    {periodFilter !== "all" ? ` · Periodo ${periodFilter}` : " · Definitiva del año"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {summary?.overallAverage != null && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{summary.overallAverage.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Promedio general</p>
                    </div>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/calificaciones/${selectedStudent.id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      Boletín
                    </Link>
                  </Button>
                </div>
              </div>

              {summaryLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
                  ))}
                </div>
              ) : !summary || summary.lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <h2 className="mt-3 text-base font-semibold text-foreground">Sin materias para este filtro</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Este estudiante no tiene materias con calificaciones en el año/periodo elegido.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Materia</TableHead>
                      <TableHead className="text-center">Definitiva</TableHead>
                      <TableHead>Desempeño</TableHead>
                      <TableHead className="pr-6 text-right">Desarrollo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.lines.map((line) => {
                      const expanded = expandedSubjectId === line.subjectId
                      const subjectMarks = expanded ? marksForSubject(line.subjectId) : []
                      return (
                        <Fragment key={line.subjectId}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => setExpandedSubjectId(expanded ? null : line.subjectId)}
                          >
                            <TableCell className="pl-6 font-medium text-foreground">{line.subjectName}</TableCell>
                            <TableCell className="text-center">
                              {line.final !== null ? (
                                <span className={`font-semibold ${line.passing ? "text-foreground" : "text-destructive"}`}>
                                  {line.final.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin notas</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {line.label ? (
                                <Badge variant={line.passing ? "outline" : "destructive"}>{line.label}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                {expanded ? "Ocultar" : "Ver notas"}
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </span>
                            </TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={4} className="bg-muted/20 p-0">
                                {subjectMarks.length === 0 ? (
                                  <p className="px-6 py-4 text-sm text-muted-foreground">
                                    No hay notas individuales registradas para este filtro.
                                  </p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-10 text-xs">Evaluación</TableHead>
                                        <TableHead className="text-center text-xs">Periodo</TableHead>
                                        <TableHead className="text-center text-xs">Nota</TableHead>
                                        <TableHead className="text-xs">Profesor</TableHead>
                                        <TableHead className="pr-6 text-right text-xs">Fecha</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {subjectMarks.map((mark) => (
                                        <TableRow key={mark.id} className="hover:bg-transparent">
                                          <TableCell className="pl-10 text-sm">{mark.title}</TableCell>
                                          <TableCell className="text-center text-sm text-muted-foreground">P{mark.period}</TableCell>
                                          <TableCell className="text-center text-sm font-medium">
                                            {mark.value} / {mark.maxValue}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {mark.teacher.user.firstName} {mark.teacher.user.lastName}
                                          </TableCell>
                                          <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                                            {new Date(mark.date).toLocaleDateString("es-CO")}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1 border-b border-border p-4 sm:p-6">
                <p className="text-base font-semibold text-foreground">
                  {isConsolidadoView ? "Consolidado General del Grado" : "Estudiantes con calificaciones"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {loading ? "Cargando..." : `${uniqueStudents.length} estudiante${uniqueStudents.length === 1 ? "" : "s"}`}
                  {isConsolidadoView && !loading && ` · ${subjectsToDisplay.length} materias registradas`}
                </p>
              </div>

              {loading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
                  ))}
                </div>
              ) : uniqueStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <Users className="h-10 w-10 text-muted-foreground" />
                  <h2 className="mt-3 text-base font-semibold text-foreground">No hay estudiantes para estos filtros</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {marks.length === 0 ? "Los profesores aún no han registrado calificaciones." : "Ajusta los filtros para ver otros resultados."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background pl-6 z-10 border-r min-w-[200px] border-b border-border">Estudiante</TableHead>
                          {isConsolidadoView && subjectsToDisplay.map((subject) => (
                            <TableHead key={subject.id} className="min-w-[120px] text-center border-b border-border">
                              <span className="truncate" title={subject.name}>{subject.name}</span>
                            </TableHead>
                          ))}
                          {!isConsolidadoView && <TableHead className="border-b border-border">Documento</TableHead>}
                          <TableHead className="pr-6 text-right min-w-[140px] border-b border-border">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedStudents.map((student) => (
                          <TableRow
                            key={student.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedStudentId(student.id)}
                          >
                            <TableCell className="sticky left-0 bg-background pl-6 border-r border-border">
                              <div className="font-medium text-foreground">
                                {student.firstName} {student.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {student.documentId ?? "-"}
                              </div>
                            </TableCell>

                            {isConsolidadoView && subjectsToDisplay.map((subject) => {
                              const finalGrade = getStudentGradeForSubject(student.id, subject.id)
                              return (
                                <TableCell key={subject.id} className="text-center">
                                  {finalGrade.percent !== null ? (
                                    <Badge variant="secondary" className="font-medium bg-secondary text-secondary-foreground">
                                      {finalGrade.percent}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                              )
                            })}

                            {!isConsolidadoView && (
                              <TableCell className="text-sm text-muted-foreground">
                                {student.documentId ?? "-"}
                              </TableCell>
                            )}

                            <TableCell className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm" asChild>
                                 <Link href={`/admin/calificaciones/${student.id}`}>
                                   <FileText className="mr-2 h-4 w-4" />
                                   Boletín
                                 </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {pageCount > 1 && (
                    <div className="flex items-center justify-between border-t border-border p-4">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
