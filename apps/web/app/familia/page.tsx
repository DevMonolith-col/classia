"use client"

// Pasa a client component el 2026-07-26: el card "Próximos Eventos" dejó de ser un array
// hardcodeado y ahora consulta la API. Ese mismo día cae el resto de la maqueta — el
// estudiante, los indicadores, las notas recientes, las tareas próximas y las notificaciones.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Calendar,
  FileText,
  MessageSquare,
  Bell,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"

type OwnStudent = {
  id: string
  firstName: string
  lastName: string
  group: { id: string; name: string } | null
}

type Mark = {
  id: string
  title: string
  value: number
  maxValue: number
  date: string
  subject: { id: string; name: string }
}

type Homework = {
  id: string
  title: string
  dueDate: string
  subject: { id: string; name: string }
}

type AttendanceRecord = { studentId: string; status: string }
type AttendanceSession = { id: string; date: string; records: AttendanceRecord[] }

type NotificationItem = {
  id: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

// Los próximos eventos ya no son un array hardcodeado: salen de GET /events, filtrados por el
// backend según la audiencia del acudiente (rol y grupos de sus hijos).
type UpcomingEvent = {
  id: string
  title: string
  startsAt: string
  allDay: boolean
  location?: string | null
}

function useUpcomingEvents() {
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await apiFetch("/events?limit=4", { silent: true })
        if (!res.ok) throw new Error("No se pudieron cargar los próximos eventos.")
        const data = (await res.json()) as UpcomingEvent[]
        if (!cancelled) setEvents(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo conectar.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { events, loading, error }
}

/** Notas normalizadas a base 100: un 8/10 y un 80/100 son el mismo desempeño. */
function percentOf(mark: Mark) {
  if (!mark.maxValue) return 0
  return (mark.value / mark.maxValue) * 100
}

function relativeDate(iso: string) {
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return "Hoy"
  if (days === 1) return "Ayer"
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })
}

function dueLabel(iso: string) {
  const date = new Date(iso)
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return "Hoy"
  if (days === 1) return "Mañana"
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })
}

export default function FamiliaDashboardPage() {
  const {
    events: upcomingEvents,
    loading: upcomingLoading,
    error: upcomingError,
  } = useUpcomingEvents()

  const [student, setStudent] = useState<OwnStudent | null>(null)
  const [marks, setMarks] = useState<Mark[]>([])
  const [homework, setHomework] = useState<Homework[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const load = useCallback(async () => {
    const studentsRes = await apiFetch("/students/mine", { silent: true })
    if (!studentsRes.ok) return
    const own = (await studentsRes.json()) as OwnStudent[]
    // El dashboard es un resumen, así que muestra al primer hijo. El selector para elegir
    // entre varios vive en cada pantalla de detalle.
    const first = own[0]
    if (!first) return
    setStudent(first)

    const [marksRes, homeworkRes, sessionsRes, notificationsRes] = await Promise.all([
      apiFetch(`/marks?studentId=${first.id}`, { silent: true }),
      apiFetch("/homework", { silent: true }),
      apiFetch("/attendance/sessions", { silent: true }),
      apiFetch("/notifications", { silent: true }),
    ])

    if (marksRes.ok) setMarks((await marksRes.json()) as Mark[])
    if (sessionsRes.ok) setSessions((await sessionsRes.json()) as AttendanceSession[])
    if (notificationsRes.ok) {
      const payload = (await notificationsRes.json()) as NotificationItem[] | { items: NotificationItem[] }
      setNotifications(Array.isArray(payload) ? payload : payload.items ?? [])
    }
    if (homeworkRes.ok) setHomework((await homeworkRes.json()) as Homework[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const average = useMemo(() => {
    if (marks.length === 0) return null
    return marks.reduce((sum, mark) => sum + percentOf(mark), 0) / marks.length
  }, [marks])

  const attendanceRate = useMemo(() => {
    const records = sessions
      .flatMap((session) => session.records)
      .filter((record) => record.studentId === student?.id)
    if (records.length === 0) return null
    return (records.filter((r) => r.status === "PRESENT").length / records.length) * 100
  }, [sessions, student])

  const upcomingTasks = useMemo(() => {
    return homework
      .filter((item) => new Date(item.dueDate).getTime() >= Date.now())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3)
  }, [homework])

  const recentGrades = useMemo(
    () =>
      [...marks]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4),
    [marks],
  )

  const recentNotifications = useMemo(() => notifications.slice(0, 3), [notifications])

  // Los indicadores de tendencia del mock ("+2.3 vs. periodo anterior") eran inventados y no
  // hay de dónde calcularlos sin comparar periodos cerrados, así que se van: un delta falso es
  // peor que ninguno. Queda el valor, y "—" cuando todavía no hay con qué calcularlo.
  const quickStats = [
    {
      title: "Promedio General",
      value: average === null ? "—" : average.toFixed(1),
      subtitle: marks.length === 1 ? "1 nota registrada" : `${marks.length} notas registradas`,
    },
    {
      title: "Asistencia",
      value: attendanceRate === null ? "—" : `${Math.round(attendanceRate)}%`,
      subtitle: "sobre la asistencia registrada",
    },
    {
      title: "Tareas Próximas",
      value: String(upcomingTasks.length),
      subtitle: "sin vencer",
    },
  ]

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-success"
    if (grade >= 70) return "text-foreground"
    return "text-destructive"
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {student ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase() : "··"}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {student ? `${student.firstName} ${student.lastName}` : "Portal de familia"}
            </h1>
            {/* Sin "Tutor:": `Group` no tiene director de grupo en el modelo, así que ese dato
                del mock no existe en ningún lado del que pudiera salir. */}
            <p className="text-muted-foreground">{student?.group?.name ?? "Sin grupo asignado"}</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/familia/mensajes">Contactar Profesor</Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {quickStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Grades */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Calificaciones Recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/calificaciones" className="gap-1">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentGrades.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay calificaciones registradas.
                </p>
              )}
              {recentGrades.map((mark) => (
                <div
                  key={mark.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{mark.subject.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{mark.title}</p>
                  </div>
                  <div className="pl-4 text-right">
                    <p className={`text-2xl font-bold ${getGradeColor(percentOf(mark))}`}>
                      {mark.value}
                      {mark.maxValue !== 100 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          /{mark.maxValue}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{relativeDate(mark.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/notificaciones">
                Ver todas
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentNotifications.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay notificaciones.</p>
              )}
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-3 ${
                    notification.isRead ? "border-border" : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <p className="text-sm text-foreground">{notification.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {relativeDate(notification.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            {/* "Próximas" y no "Pendientes": saber si ya entregó exige una consulta por tarea
                (GET /homework no trae la entrega), y eso es trabajo del detalle, no del
                resumen. Decir "pendientes" sin mirar las entregas seria mentir. */}
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tareas Próximas
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/tareas">
                Ver todas
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay tareas por vencer.</p>
              )}
              {upcomingTasks.map((task) => {
                const label = dueLabel(task.dueDate)
                const isSoon = label === "Hoy" || label === "Mañana"

                return (
                  <div key={task.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.subject.name}
                        </p>
                      </div>
                      {isSoon ? (
                        <Clock className="h-4 w-4 shrink-0 text-warning" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <p
                      className={`mt-2 text-xs font-medium ${
                        isSoon ? "text-warning" : "text-muted-foreground"
                      }`}
                    >
                      Entrega: {label}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
            {/* Apuntaba a /familia/horario, que sigue siendo mock. Ahora va al calendario real. */}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/calendario">
                Ver calendario
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingLoading && (
                <p className="text-sm text-muted-foreground">Cargando próximos eventos…</p>
              )}
              {!upcomingLoading && upcomingError && (
                <p className="text-sm text-muted-foreground">{upcomingError}</p>
              )}
              {!upcomingLoading && !upcomingError && upcomingEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay eventos próximos en el calendario del colegio.
                </p>
              )}
              {upcomingEvents.map((event) => {
                const date = new Date(event.startsAt)
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <span className="text-xs font-medium">
                        {date.toLocaleDateString("es-CO", { day: "2-digit" })}
                      </span>
                      <span className="text-xs">
                        {date.toLocaleDateString("es-CO", { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.allDay
                          ? "Todo el día"
                          : date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link href="/familia/calificaciones">
                  <CheckCircle2 className="h-4 w-4" />
                  Ver Calificaciones
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link href="/familia/asistencia">
                  <Calendar className="h-4 w-4" />
                  Ver Asistencia
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link href="/familia/mensajes">
                  <MessageSquare className="h-4 w-4" />
                  Mensajes
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
