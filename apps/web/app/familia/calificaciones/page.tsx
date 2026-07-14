"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { Download, AlertTriangle, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"
import type { Mark } from "@/components/profesor/marks-types"
import { StudentGradesTable } from "@/components/shared/student-grades-table"

const PERIOD_OPTIONS = [1, 2, 3, 4]

interface Student {
  id: string
  firstName: string
  lastName: string
  group: { name: string } | null
}

export default function CalificacionesFamiliaPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL")
  const [periodFilter, setPeriodFilter] = useState<string>("all")
  const [marks, setMarks] = useState<Mark[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      // In a real scenario, this endpoint should only return the parent's children.
      const res = await apiFetch("/students", { silent: true })
      if (!res.ok) throw new Error("No se pudieron cargar los estudiantes vinculados.")
      const data = (await res.json()) as Student[]
      setStudents(data)
      if (data.length > 0) {
        setSelectedStudentId(data[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const loadMarks = useCallback(async (studentId: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/marks?studentId=${studentId}`, { silent: true })
      if (!res.ok) throw new Error("No se pudieron cargar las calificaciones.")
      setMarks((await res.json()) as Mark[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las notas.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedStudentId) {
      loadMarks(selectedStudentId)
    }
  }, [selectedStudentId, loadMarks])

  const activeStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId])

  const availableSubjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    marks.forEach(m => map.set(m.subject.id, { id: m.subject.id, name: m.subject.name }))
    return Array.from(map.values())
  }, [marks])

  const filteredMarks = useMemo(() => {
    let list = marks
    if (selectedSubjectId !== "ALL") list = list.filter((m) => m.subject.id === selectedSubjectId)
    if (periodFilter !== "all") list = list.filter((m) => String(m.period) === periodFilter)
    return list
  }, [marks, selectedSubjectId, periodFilter])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Calificaciones
          </h1>
          <p className="mt-1 text-muted-foreground">
            Consulta el boletín de calificaciones
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Descargar Boleta
        </Button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {students.length > 0 && (
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:w-64">
              <Label>Estudiante</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} {student.group ? `(${student.group.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      )}

      {loading && students.length === 0 ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
        </div>
      ) : activeStudent ? (
        <StudentGradesTable 
          marks={filteredMarks} 
          studentName={`${activeStudent.firstName} ${activeStudent.lastName}`} 
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No tienes estudiantes vinculados.</p>
        </div>
      )}
    </div>
  )
}
