"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_SHORT,
  DAY_LABELS,
  type AttendanceSession,
  type AttendanceStatus,
  type TeacherSchedule,
} from "@/components/profesor/attendance-types"

const STATUS_ORDER: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "JUSTIFIED", "PERMISSION"]

type DraftRecord = { status: AttendanceStatus; observation: string }

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export default function AsistenciaProfesorPage() {
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [history, setHistory] = useState<AttendanceSession[]>([])
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [setupError, setSetupError] = useState("")

  const [selectedScheduleId, setSelectedScheduleId] = useState("")
  const [selectedDate, setSelectedDate] = useState(today())
  const [session, setSession] = useState<AttendanceSession | null>(null)
  const [draft, setDraft] = useState<Record<string, DraftRecord>>({})
  const [loadingSession, setLoadingSession] = useState(false)
  const [sessionError, setSessionError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [togglingOpen, setTogglingOpen] = useState(false)

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

      const [schedulesRes, historyRes] = await Promise.all([
        apiFetch(`/schedules?teacherId=${id}`, { silent: true }),
        apiFetch(`/attendance/sessions?teacherId=${id}`, { silent: true }),
      ])

      const schedulesData = schedulesRes.ok ? ((await schedulesRes.json()) as TeacherSchedule[]) : []
      const historyData = historyRes.ok ? ((await historyRes.json()) as AttendanceSession[]) : []
      setSchedules(schedulesData)
      setHistory(historyData)
      if (schedulesData.length > 0) setSelectedScheduleId(schedulesData[0].id)
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoadingSetup(false)
    }
  }, [])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  const openSession = useCallback(async (scheduleId: string, date: string) => {
    if (!scheduleId || !date) return
    setLoadingSession(true)
    setSessionError("")
    setSession(null)
    try {
      const res = await apiFetch("/attendance/sessions", {
        method: "POST",
        body: JSON.stringify({ scheduleId, date }),
        silent: true,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo abrir la asistencia para esta clase.")
      }
      const data = (await res.json()) as AttendanceSession
      setSession(data)
      setDraft(
        Object.fromEntries(
          data.records.map((record) => [
            record.studentId,
            { status: record.status, observation: record.observation ?? "" },
          ]),
        ),
      )
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoadingSession(false)
    }
  }, [])

  useEffect(() => {
    if (selectedScheduleId && selectedDate) {
      openSession(selectedScheduleId, selectedDate)
    }
  }, [selectedScheduleId, selectedDate, openSession])

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDraft((current) => ({
      ...current,
      [studentId]: { status, observation: status === "PRESENT" ? "" : (current[studentId]?.observation ?? "") },
    }))
  }

  function setObservation(studentId: string, observation: string) {
    setDraft((current) => ({
      ...current,
      [studentId]: { ...current[studentId], observation },
    }))
  }

  function markAllPresent() {
    setDraft((current) => {
      const next: Record<string, DraftRecord> = {}
      for (const studentId of Object.keys(current)) {
        next[studentId] = { status: "PRESENT", observation: "" }
      }
      return next
    })
  }

  async function handleSave() {
    if (!session) return
    setSubmitting(true)
    try {
      const records = Object.entries(draft).map(([studentId, value]) => ({
        studentId,
        status: value.status,
        observation: value.observation.trim() || undefined,
      }))

      const res = await apiFetch(`/attendance/sessions/${session.id}/records`, {
        method: "PUT",
        body: JSON.stringify({ records }),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la asistencia.")
      }

      const updated = (await res.json()) as AttendanceSession
      setSession(updated)
      toast.success("Asistencia guardada", {
        description: `${updated.group.name} · ${new Date(updated.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "UTC" })}`,
      })
      setHistory((current) => {
        const exists = current.some((s) => s.id === updated.id)
        return exists ? current.map((s) => (s.id === updated.id ? updated : s)) : [updated, ...current]
      })
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleOpen() {
    if (!session) return
    setTogglingOpen(true)
    try {
      const res = await apiFetch(`/attendance/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isOpen: !session.isOpen }),
        silent: true,
      })
      if (!res.ok) throw new Error("No se pudo actualizar el estado de la sesión.")
      const updated = (await res.json()) as AttendanceSession
      setSession(updated)
      setHistory((current) => current.map((s) => (s.id === updated.id ? updated : s)))
      toast.success(updated.isOpen ? "Asistencia reabierta" : "Asistencia cerrada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setTogglingOpen(false)
    }
  }

  const stats = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      JUSTIFIED: 0,
      PERMISSION: 0,
    }
    for (const value of Object.values(draft)) counts[value.status]++
    return counts
  }, [draft])

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asistencia</h1>
        <p className="mt-1 text-muted-foreground">Registra la asistencia de tus estudiantes por clase y fecha.</p>
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
            <CalendarClock className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-base font-semibold text-foreground">Aún no tienes clases asignadas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pide a la administración que te asigne horarios para poder tomar asistencia.
            </p>
          </CardContent>
        </Card>
      )}

      {!loadingSetup && schedules.length > 0 && (
        <>
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Clase</Label>
                <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
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
              <div className="space-y-2 sm:w-48">
                <Label htmlFor="attendance-date">Fecha</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => openSession(selectedScheduleId, selectedDate)}
                disabled={loadingSession}
              >
                <RefreshCw className={`h-4 w-4 ${loadingSession ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </CardContent>
          </Card>

          {sessionError && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{sessionError}</p>
            </div>
          )}

          {loadingSession ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
                ))}
              </CardContent>
            </Card>
          ) : session ? (
            <>
              <Card className="mb-6">
                <CardHeader className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>
                      {session.group.name} · {session.schedule?.subject.name ?? selectedSchedule?.subject.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(session.date).toLocaleDateString("es-CO", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                      {session.schedule?.room ? ` · ${session.schedule.room}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={session.isOpen ? "outline" : "secondary"} className="gap-1.5">
                      {session.isOpen ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {session.isOpen ? "Abierta" : "Cerrada"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={toggleOpen} disabled={togglingOpen}>
                      {togglingOpen && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      {session.isOpen ? "Cerrar" : "Reabrir"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {STATUS_ORDER.map((status) => (
                      <div key={status} className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xl font-bold text-foreground">{stats[status]}</p>
                        <p className="text-xs text-muted-foreground">{ATTENDANCE_STATUS_LABELS[status]}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Estudiantes ({session.records.length})
                    </CardTitle>
                  </div>
                  {session.isOpen && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={markAllPresent}>
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar todos presentes
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {session.records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <Users className="h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 text-base font-semibold text-foreground">Este grupo no tiene estudiantes activos</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {session.records.map((record) => {
                        const value = draft[record.studentId] ?? { status: record.status, observation: record.observation ?? "" }
                        return (
                          <div key={record.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {record.student.firstName} {record.student.lastName}
                              </p>
                              {record.student.documentId && (
                                <p className="text-xs text-muted-foreground">{record.student.documentId}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex gap-1.5">
                                {STATUS_ORDER.map((status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    disabled={!session.isOpen}
                                    onClick={() => setStatus(record.studentId, status)}
                                    title={ATTENDANCE_STATUS_LABELS[status]}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                      value.status === status
                                        ? ATTENDANCE_STATUS_COLORS[status]
                                        : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                                    }`}
                                  >
                                    {ATTENDANCE_STATUS_SHORT[status]}
                                  </button>
                                ))}
                              </div>
                              {value.status !== "PRESENT" && (
                                <Input
                                  value={value.observation}
                                  onChange={(event) => setObservation(record.studentId, event.target.value)}
                                  placeholder="Observación (opcional)"
                                  disabled={!session.isOpen}
                                  className="h-8 w-48"
                                />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {session.isOpen && session.records.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSave} disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar asistencia
                  </Button>
                </div>
              )}
            </>
          ) : null}

          {history.length > 0 && (
            <Card className="mt-8">
              <CardHeader className="border-b border-border">
                <CardTitle>Historial reciente</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {history
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .slice(0, 8)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.schedule) {
                          setSelectedScheduleId(item.schedule.id)
                          setSelectedDate(item.date.slice(0, 10))
                        }
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-secondary/50"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {item.group.name} · {item.schedule?.subject.name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                        </p>
                      </div>
                      <Badge variant={item.isOpen ? "outline" : "secondary"} className="gap-1.5">
                        {item.isOpen ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {item.isOpen ? "Abierta" : "Cerrada"}
                      </Badge>
                    </button>
                  ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
