"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" | "PERMISSION"

interface OwnStudent {
  id: string
  firstName: string
  lastName: string
  group: { id: string; name: string } | null
}

interface SessionRecord {
  id: string
  studentId: string
  status: AttendanceStatus
  observation: string | null
}

interface AttendanceSession {
  id: string
  date: string
  group: { id: string; name: string }
  schedule: {
    id: string
    startTime: string
    endTime: string
    subject: { id: string; name: string }
  } | null
  records: SessionRecord[]
}

/** Una clase del día con lo que le pasó al hijo en ella. */
interface DayEntry {
  sessionId: string
  subject: string
  startTime: string | null
  status: AttendanceStatus
  observation: string | null
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  LATE: "Tardanza",
  JUSTIFIED: "Justificado",
  PERMISSION: "Permiso",
}

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-500",
  ABSENT: "bg-red-500",
  LATE: "bg-yellow-500",
  JUSTIFIED: "bg-blue-500",
  PERMISSION: "bg-purple-500",
}

// Un día tiene varias clases y puede mezclar estados. En la grilla mensual entra un solo
// símbolo, así que gana el más grave: que el día se vea verde porque cuatro de cinco clases
// estuvieron bien sería exactamente el dato que la familia no puede perderse.
const STATUS_SEVERITY: Record<AttendanceStatus, number> = {
  PRESENT: 0,
  PERMISSION: 1,
  JUSTIFIED: 2,
  LATE: 3,
  ABSENT: 4,
}

const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

/**
 * Clave de día en UTC. El backend normaliza `date` a medianoche UTC
 * (`attendance.service.ts#normalizeDate`), así que leerla con getDate() local correría
 * el registro un día hacia atrás en toda América.
 */
function dayKeyOf(iso: string) {
  return iso.slice(0, 10)
}

function localDayKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function statusIcon(status: AttendanceStatus) {
  switch (status) {
    case "PRESENT":
      return <Check className="h-4 w-4 text-white" />
    case "ABSENT":
      return <X className="h-4 w-4 text-white" />
    case "LATE":
      return <Clock className="h-4 w-4 text-white" />
    case "JUSTIFIED":
      return <span className="text-xs font-bold text-white">J</span>
    case "PERMISSION":
      return <span className="text-xs font-bold text-white">P</span>
  }
}

export default function AsistenciaFamiliaPage() {
  const [students, setStudents] = useState<OwnStudent[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadStudents = useCallback(async () => {
    setError("")
    try {
      const res = await apiFetch("/students/mine", { silent: true })
      if (!res.ok) throw new Error("No se pudieron cargar los estudiantes vinculados.")
      const data = (await res.json()) as OwnStudent[]
      setStudents(data)
      setSelectedStudentId((current) => current || data[0]?.id || "")
      if (data.length === 0) setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar.")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const loadSessions = useCallback(async (month: Date) => {
    setLoading(true)
    setError("")
    try {
      const year = month.getFullYear()
      const monthIndex = month.getMonth()
      const from = new Date(Date.UTC(year, monthIndex, 1)).toISOString()
      const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59)).toISOString()

      const res = await apiFetch(
        `/attendance/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { silent: true },
      )
      if (!res.ok) throw new Error("No se pudo cargar la asistencia del mes.")
      setSessions((await res.json()) as AttendanceSession[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la asistencia.")
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedStudentId) loadSessions(currentMonth)
  }, [selectedStudentId, currentMonth, loadSessions])

  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId],
  )

  /**
   * Día → clases de ese día con el registro del hijo seleccionado.
   *
   * El backend ya recorta los `records` a los hijos del acudiente, pero devuelve las sesiones
   * de **todos** sus grupos: un acudiente con dos hijos en cursos distintos recibe las dos
   * agendas mezcladas. El filtro por `studentId` es lo que separa una de la otra, y de paso
   * descarta las sesiones donde el hijo no tiene registro.
   */
  const byDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>()
    if (!selectedStudentId) return map

    for (const session of sessions) {
      const record = session.records.find((r) => r.studentId === selectedStudentId)
      if (!record) continue

      const key = dayKeyOf(session.date)
      const entry: DayEntry = {
        sessionId: session.id,
        subject: session.schedule?.subject.name ?? "Clase",
        startTime: session.schedule?.startTime ?? null,
        status: record.status,
        observation: record.observation,
      }
      const existing = map.get(key)
      if (existing) existing.push(entry)
      else map.set(key, [entry])
    }

    for (const entries of map.values()) {
      entries.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
    }
    return map
  }, [sessions, selectedStudentId])

  const worstStatusOf = useCallback(
    (entries: DayEntry[]) =>
      entries.reduce<AttendanceStatus>(
        (worst, entry) =>
          STATUS_SEVERITY[entry.status] > STATUS_SEVERITY[worst] ? entry.status : worst,
        "PRESENT",
      ),
    [],
  )

  const stats = useMemo(() => {
    const all = Array.from(byDay.values()).flat()
    const presentes = all.filter((e) => e.status === "PRESENT").length
    return {
      total: all.length,
      presentes,
      ausentes: all.filter((e) => e.status === "ABSENT").length,
      tardanzas: all.filter((e) => e.status === "LATE").length,
      porcentaje: all.length > 0 ? Math.round((presentes / all.length) * 100) : null,
    }
  }, [byDay])

  const needsAttention = useMemo(() => {
    return Array.from(byDay.entries())
      .flatMap(([day, entries]) => entries.map((entry) => ({ day, ...entry })))
      .filter((entry) => entry.status !== "PRESENT")
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 4)
  }, [byDay])

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startingDay = new Date(year, month, 1).getDay()

    const days: (number | null)[] = []
    for (let i = 0; i < startingDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedDate(null)
    setCurrentMonth((current) => {
      const next = new Date(current)
      next.setMonth(current.getMonth() + (direction === "next" ? 1 : -1))
      return next
    })
  }

  const selectedEntries = selectedDate ? byDay.get(selectedDate) ?? [] : []
  const today = new Date()
  const todayKey = localDayKey(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Asistencia</h1>
            <p className="mt-1 text-muted-foreground">
              {activeStudent
                ? `Historial de ${activeStudent.firstName} ${activeStudent.lastName}${
                    activeStudent.group ? ` — ${activeStudent.group.name}` : ""
                  }`
                : "Historial de asistencia"}
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {students.length > 1 && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="w-full space-y-2 sm:w-64">
                  <Label>Estudiante</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                          {student.group ? ` (${student.group.name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && students.length === 0 && !error && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No hay estudiantes vinculados a esta cuenta.
                </p>
              </CardContent>
            </Card>
          )}

          {students.length > 0 && (
            <>
              {/* Stats */}
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {stats.porcentaje === null ? "—" : `${stats.porcentaje}%`}
                        </p>
                        <p className="text-xs text-muted-foreground">Asistencia</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <Check className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{stats.presentes}</p>
                        <p className="text-xs text-muted-foreground">Presentes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <X className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{stats.ausentes}</p>
                        <p className="text-xs text-muted-foreground">Ausencias</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{stats.tardanzas}</p>
                        <p className="text-xs text-muted-foreground">Tardanzas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Calendar */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        Calendario de Asistencia
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-32 text-center font-medium">
                          {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-1">
                      {weekDays.map((day) => (
                        <div
                          key={day}
                          className="p-2 text-center text-xs font-medium text-muted-foreground"
                        >
                          {day}
                        </div>
                      ))}
                      {getMonthDays(currentMonth).map((day, index) => {
                        const dateStr = day
                          ? localDayKey(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                          : ""
                        const entries = day ? byDay.get(dateStr) : undefined
                        const status = entries && entries.length > 0 ? worstStatusOf(entries) : null

                        return (
                          <button
                            key={index}
                            disabled={!entries}
                            onClick={() => entries && setSelectedDate(dateStr)}
                            className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm transition-colors lg:h-12 ${
                              !day
                                ? ""
                                : !entries
                                ? "text-muted-foreground/50"
                                : selectedDate === dateStr
                                ? "ring-2 ring-primary ring-offset-2"
                                : "hover:bg-muted"
                            } ${dateStr === todayKey ? "font-bold text-primary" : ""}`}
                          >
                            {day && (
                              <>
                                <span className={status ? "sr-only" : ""}>{day}</span>
                                {status && (
                                  <div
                                    className={`flex h-7 w-7 items-center justify-center rounded-full ${STATUS_COLOR[status]}`}
                                  >
                                    {statusIcon(status)}
                                  </div>
                                )}
                              </>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {!loading && byDay.size === 0 && (
                      <p className="mt-4 text-center text-sm text-muted-foreground">
                        No hay asistencia registrada en {months[currentMonth.getMonth()].toLowerCase()}.
                      </p>
                    )}

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
                      {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((status) => (
                        <div key={status} className="flex items-center gap-2">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full ${STATUS_COLOR[status]}`}
                          >
                            {statusIcon(status)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {STATUS_LABEL[status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Details */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Detalles</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedEntries.length > 0 ? (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-ES", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </p>
                          {selectedEntries.map((entry) => (
                            <div key={entry.sessionId} className="space-y-1 border-t border-border pt-3 first:border-0 first:pt-0">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STATUS_COLOR[entry.status]}`}
                                >
                                  {statusIcon(entry.status)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {entry.subject}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {STATUS_LABEL[entry.status]}
                                    {entry.startTime ? ` · ${entry.startTime}` : ""}
                                  </p>
                                </div>
                              </div>
                              {entry.observation && (
                                <p className="pl-11 text-sm text-muted-foreground">
                                  {entry.observation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">
                            Selecciona un día para ver los detalles
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {needsAttention.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Atención Requerida
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {needsAttention.map((entry) => (
                          <button
                            key={`${entry.day}-${entry.sessionId}`}
                            onClick={() => setSelectedDate(entry.day)}
                            className="flex w-full items-center gap-3 rounded-lg bg-muted p-3 text-left transition-colors hover:bg-muted/70"
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STATUS_COLOR[entry.status]}`}
                            >
                              {statusIcon(entry.status)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {STATUS_LABEL[entry.status]}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {new Date(`${entry.day}T12:00:00`).toLocaleDateString("es-ES", {
                                  day: "numeric",
                                  month: "short",
                                })}
                                {` · ${entry.subject}`}
                              </p>
                            </div>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
