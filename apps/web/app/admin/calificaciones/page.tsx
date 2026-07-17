"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FileText, Users } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { computeWeightedFinal } from "@/lib/grading"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TeacherCombobox } from "@/components/admin/teacher-combobox"
import type { Mark } from "@/components/admin/marks-types"
import type { Teacher } from "@/components/admin/academic-types"

const PERIOD_OPTIONS = [1, 2, 3, 4]

type Group = { id: string; name: string; grade: string; section: string }
type AcademicYear = { id: string; name: string; isActive: boolean }

export default function AdminCalificacionesPage() {
  const [marks, setMarks] = useState<Mark[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedYearId, setSelectedYearId] = useState<string>("")
  const [selectedGroupId, setSelectedGroupId] = useState<string>("ALL")
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL")
  const [periodFilter, setPeriodFilter] = useState<string>("all")

  const loadBaseData = useCallback(async () => {
    try {
      const [teachersRes, groupsRes, yearsRes] = await Promise.all([
        apiFetch("/teachers", { silent: true }),
        apiFetch("/groups", { silent: true }),
        apiFetch("/academic-years", { silent: true }),
      ])

      setTeachers(teachersRes.ok ? (((await teachersRes.json()) as Teacher[]) ?? []) : [])
      setGroups(groupsRes.ok ? (((await groupsRes.json()) as Group[]) ?? []) : [])
      
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



  const filteredMarks = useMemo(() => {
    let list = marks
    if (selectedGroupId !== "ALL") list = list.filter((m) => m.student.groupId === selectedGroupId)
    if (selectedTeacherId) list = list.filter((m) => m.teacher.id === selectedTeacherId)
    if (selectedSubjectId !== "ALL") list = list.filter((m) => m.subject.id === selectedSubjectId)
    if (periodFilter !== "all") list = list.filter((m) => String(m.period) === periodFilter)
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [marks, selectedGroupId, selectedTeacherId, selectedSubjectId, periodFilter])

  const availableSubjects = useMemo(() => {
    let list = marks
    if (selectedGroupId !== "ALL") list = list.filter((m) => m.student.groupId === selectedGroupId)
    if (selectedTeacherId) list = list.filter((m) => m.teacher.id === selectedTeacherId)
    
    const map = new Map<string, { id: string; name: string }>()
    list.forEach(m => map.set(m.subject.id, { id: m.subject.id, name: m.subject.name }))
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [marks, selectedGroupId, selectedTeacherId])

  // Reset subject filter if teacher or group changes and selected subject is no longer available
  useEffect(() => {
    if (selectedSubjectId !== "ALL" && !availableSubjects.find(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId("ALL")
    }
  }, [availableSubjects, selectedSubjectId])

  const uniqueStudents = useMemo(() => {
    const map = new Map<string, typeof marks[0]['student']>()
    for (const mark of filteredMarks) {
      if (!map.has(mark.student.id)) {
        map.set(mark.student.id, mark.student)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.firstName.localeCompare(b.firstName))
  }, [filteredMarks])

  // subjectsToDisplay logic for Consolidado
  const subjectsToDisplay = useMemo(() => {
    if (selectedSubjectId !== "ALL") {
      const s = availableSubjects.find(sub => sub.id === selectedSubjectId)
      return s ? [s] : []
    }
    return availableSubjects
  }, [availableSubjects, selectedSubjectId])

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

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end flex-wrap">
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
          <div className="w-full space-y-2 sm:w-56">
            <Label>Profesor</Label>
            <TeacherCombobox teachers={teachers} value={selectedTeacherId} onChange={setSelectedTeacherId} allowAll />
          </div>
          <div className="w-full space-y-2 sm:w-56">
            <Label>Materia</Label>
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las materias</SelectItem>
                {availableSubjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>
            {isConsolidadoView ? "Consolidado General del Grado" : "Estudiantes con calificaciones"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${uniqueStudents.length} estudiante${uniqueStudents.length === 1 ? "" : "s"}`}
            {isConsolidadoView && !loading && ` · ${subjectsToDisplay.length} materias registradas`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
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
                  {uniqueStudents.map((student) => (
                    <TableRow key={student.id}>
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

                      <TableCell className="pr-6 text-right">
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
