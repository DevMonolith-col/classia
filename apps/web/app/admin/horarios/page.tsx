"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, Pencil, Plus, RefreshCw, User } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ScheduleFormDialog } from "@/components/admin/schedule-form-dialog"
import { TeacherCombobox } from "@/components/admin/teacher-combobox"
import {
  DAY_LABELS,
  type Group,
  type Schedule,
  type Subject,
  type Teacher,
} from "@/components/admin/academic-types"

export default function AdminHorariosPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [dayFilter, setDayFilter] = useState<string>("all")
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTeacher, setDialogTeacher] = useState<Teacher | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [schedulesRes, groupsRes, subjectsRes, teachersRes] = await Promise.all([
        apiFetch("/schedules", { silent: true }),
        apiFetch("/groups", { silent: true }),
        apiFetch("/subjects", { silent: true }),
        apiFetch("/teachers", { silent: true }),
      ])

      if (!schedulesRes.ok) {
        throw new Error(schedulesRes.status === 403 ? "No tienes permiso para ver los horarios." : "No se pudo cargar el listado de horarios.")
      }

      setSchedules(((await schedulesRes.json()) as Schedule[]) ?? [])
      setGroups(groupsRes.ok ? (((await groupsRes.json()) as Group[]) ?? []) : [])
      setSubjects(subjectsRes.ok ? (((await subjectsRes.json()) as Subject[]) ?? []) : [])
      setTeachers(teachersRes.ok ? (((await teachersRes.json()) as Teacher[]) ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === selectedTeacherId) ?? null,
    [teachers, selectedTeacherId],
  )

  const filteredSchedules = useMemo(() => {
    let list = selectedTeacherId ? schedules.filter((s) => s.teacher.id === selectedTeacherId) : schedules
    if (dayFilter !== "all") list = list.filter((s) => String(s.dayOfWeek) === dayFilter)
    return [...list].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
  }, [schedules, selectedTeacherId, dayFilter])

  function openCreateDialog() {
    if (!selectedTeacher) return
    setDialogTeacher(selectedTeacher)
    setEditingSchedule(null)
    setDialogOpen(true)
  }

  function openEditDialog(sch: Schedule) {
    const teacher = teachers.find((t) => t.id === sch.teacher.id)
    if (!teacher) return
    setDialogTeacher(teacher)
    setEditingSchedule(sch)
    setDialogOpen(true)
  }

  function handleSaved(saved: Schedule) {
    setSchedules((current) => {
      const exists = current.some((schedule) => schedule.id === saved.id)
      if (exists) return current.map((schedule) => (schedule.id === saved.id ? saved : schedule))
      return [...current, saved]
    })
  }

  const hasCatalog = groups.length > 0 && subjects.length > 0 && teachers.length > 0

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Horarios</h1>
          <p className="mt-1 text-muted-foreground">Busca un profesor para ver y gestionar su horario de clases.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!loading && !hasCatalog && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Necesitas al menos un grupo, una materia y un profesor registrados antes de crear un horario.</p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-foreground">Profesor</label>
            <TeacherCombobox
              teachers={teachers}
              value={selectedTeacherId}
              onChange={setSelectedTeacherId}
              allowAll
            />
          </div>
          <div className="w-full space-y-2 sm:w-48">
            <label className="text-sm font-medium text-foreground">Día</label>
            <Select value={dayFilter} onValueChange={setDayFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos los días" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los días</SelectItem>
                {Object.entries(DAY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="gap-2"
            onClick={openCreateDialog}
            disabled={!selectedTeacher || !hasCatalog}
            title={!selectedTeacher ? "Selecciona un profesor para crear un horario" : undefined}
          >
            <Plus className="h-4 w-4" />
            Nuevo horario
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1 border-b border-border">
          <CardTitle>
            {selectedTeacher
              ? `Horario de ${selectedTeacher.user.firstName} ${selectedTeacher.user.lastName}`
              : "Todos los horarios"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Cargando..."
              : selectedTeacher
                ? `${filteredSchedules.length} bloque${filteredSchedules.length === 1 ? "" : "s"} asignado${filteredSchedules.length === 1 ? "" : "s"}`
                : `${filteredSchedules.length} bloque${filteredSchedules.length === 1 ? "" : "s"} en total · busca un profesor arriba para crear o editar`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                {selectedTeacher ? "Este profesor aún no tiene horarios" : "Aún no hay horarios registrados"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedTeacher ? "Crea el primer bloque con el botón de arriba." : "Busca un profesor arriba para crear el primer horario."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Día y hora</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Materia</TableHead>
                  {!selectedTeacher && <TableHead>Profesor</TableHead>}
                  <TableHead>Aula</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{DAY_LABELS[schedule.dayOfWeek]}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {schedule.startTime} - {schedule.endTime}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{schedule.group.name}</TableCell>
                    <TableCell className="text-sm text-foreground">{schedule.subject.name}</TableCell>
                    {!selectedTeacher && (
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {schedule.teacher.user.firstName} {schedule.teacher.user.lastName}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">{schedule.room ?? "—"}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(schedule)}>
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

      {dialogTeacher && (
        <ScheduleFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          schedule={editingSchedule}
          teacher={dialogTeacher}
          groups={groups}
          subjects={subjects}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
