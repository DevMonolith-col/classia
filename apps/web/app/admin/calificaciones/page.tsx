"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ClipboardList, Pencil } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
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
import { MarkEditDialog } from "@/components/admin/mark-edit-dialog"
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
  const [periodFilter, setPeriodFilter] = useState<string>("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeMark, setActiveMark] = useState<Mark | null>(null)

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
    if (periodFilter !== "all") list = list.filter((m) => String(m.period) === periodFilter)
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [marks, selectedTeacherId, periodFilter])

  function openEdit(mark: Mark) {
    setActiveMark(mark)
    setDialogOpen(true)
  }

  function handleSaved(saved: Mark) {
    setMarks((current) => current.map((m) => (m.id === saved.id ? saved : m)))
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

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:w-72">
            <Label>Profesor</Label>
            <TeacherCombobox teachers={teachers} value={selectedTeacherId} onChange={setSelectedTeacherId} allowAll />
          </div>
          <div className="w-full space-y-2 sm:w-48">
            <Label>Periodo</Label>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los periodos</SelectItem>
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
          <CardTitle>Calificaciones registradas</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${filteredMarks.length} calificación${filteredMarks.length === 1 ? "" : "es"}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : filteredMarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">No hay calificaciones para estos filtros</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {marks.length === 0 ? "Los profesores aún no han registrado calificaciones." : "Ajusta los filtros para ver otras."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Título</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Materia</TableHead>
                  <TableHead>Profesor</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMarks.map((mark) => (
                  <TableRow key={mark.id}>
                    <TableCell className="pl-6">
                      <div>
                        <p className="text-sm font-medium text-foreground">{mark.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(mark.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {mark.student.firstName} {mark.student.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mark.subject.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mark.teacher.user.firstName} {mark.teacher.user.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mark.period}</TableCell>
                    <TableCell>
                      <Badge variant={mark.isPublished ? "outline" : "secondary"}>
                        {mark.value} / {mark.maxValue}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEdit(mark)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MarkEditDialog open={dialogOpen} onOpenChange={setDialogOpen} mark={activeMark} onSaved={handleSaved} />
    </div>
  )
}
