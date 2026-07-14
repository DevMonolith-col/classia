"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Mark } from "@/components/profesor/marks-types"

import { StudentGradesTable } from "@/components/shared/student-grades-table"

const PERIOD_OPTIONS = [1, 2, 3, 4]

export default function AlumnoCalificacionesPage() {
  const [marks, setMarks] = useState<Mark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL")
  const [periodFilter, setPeriodFilter] = useState<string>("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/marks", { silent: true })
      if (!res.ok) throw new Error("No se pudieron cargar tus calificaciones.")
      setMarks((await res.json()) as Mark[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Calificaciones</h1>
        <p className="mt-1 text-muted-foreground">Tus notas por materia.</p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : (
        <StudentGradesTable marks={filteredMarks} />
      )}
    </div>
  )
}
