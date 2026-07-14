"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Users } from "lucide-react"
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

export default function AdminCalificacionesPage() {
  const [marks, setMarks] = useState<Mark[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL")
  const [periodFilter, setPeriodFilter] = useState<string>("all")

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [marksRes, teachersRes] = await Promise.all([
        apiFetch("/marks", { silent: true }),
        apiFetch("/teachers", { silent: true }),
      ])

      if (!marksRes.ok) {
        throw new Error(marksRes.status === 403 ? "No tienes permiso para ver las calificaciones." : "No se pudo cargar las calificaciones.")
      }

      setMarks(((await marksRes.json()) as Mark[]) ?? [])
      setTeachers(teachersRes.ok ? (((await teachersRes.json()) as Teacher[]) ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setMarks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filteredMarks = useMemo(() => {
    let list = marks
    if (selectedTeacherId) list = list.filter((m) => m.teacher.id === selectedTeacherId)
    if (selectedSubjectId !== "ALL") list = list.filter((m) => m.subject.id === selectedSubjectId)
    if (periodFilter !== "all") list = list.filter((m) => String(m.period) === periodFilter)
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [marks, selectedTeacherId, selectedSubjectId, periodFilter])

  const availableSubjects = useMemo(() => {
    let list = marks
    if (selectedTeacherId) list = list.filter((m) => m.teacher.id === selectedTeacherId)
    const map = new Map<string, { id: string; name: string }>()
    list.forEach(m => map.set(m.subject.id, { id: m.subject.id, name: m.subject.name }))
    return Array.from(map.values())
  }, [marks, selectedTeacherId])

  // Reset subject filter if teacher changes and selected subject is no longer available
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
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:w-72">
            <Label>Profesor</Label>
            <TeacherCombobox teachers={teachers} value={selectedTeacherId} onChange={setSelectedTeacherId} allowAll />
          </div>
          <div className="w-full space-y-2 sm:w-64">
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
          <CardTitle>Estudiantes con calificaciones</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${uniqueStudents.length} estudiante${uniqueStudents.length === 1 ? "" : "s"}`}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Estudiante</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="pl-6 font-medium text-foreground">
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.documentId ?? "-"}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="outline" size="sm" asChild>
                         <Link href={`/admin/calificaciones/${student.id}`}>
                           Ver boletín
                         </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
