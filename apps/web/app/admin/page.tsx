"use client"

import { useEffect, useState } from "react"
import {
  Users,
  GraduationCap,
  BookOpen,
  AlertCircle,
  Calendar,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"
import type { Student } from "@/components/admin/student-types"
import type { Teacher, Group } from "@/components/admin/academic-types"
import type { AuditLog, AuditLogsResponse } from "@/components/superadmin/audit-types"
import type { User } from "@/components/superadmin/user-types"
import { humanizeAuditAction, isInstitutionalAction } from "@/components/shared/audit-labels"

type AttendanceRecord = { status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" }
type AttendanceSession = { date: string; records: AttendanceRecord[] }

type SchoolEvent = { id: string; title: string; date: string; location?: string | null }

type DashboardStats = {
  totalStudents: number
  activeTeachers: number
  totalGroups: number
  attendanceToday: number | null
}

function todayRangeIso() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { from: start.toISOString(), to: end.toISOString() }
}

function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const { from, to } = todayRangeIso()
        const [studentsRes, teachersRes, groupsRes, attendanceRes] = await Promise.all([
          apiFetch("/students", { silent: true }),
          apiFetch("/teachers", { silent: true }),
          apiFetch("/groups", { silent: true }),
          apiFetch(`/attendance/sessions?from=${from}&to=${to}`, { silent: true }),
        ])

        if (!studentsRes.ok || !teachersRes.ok || !groupsRes.ok) {
          throw new Error("No se pudieron cargar las estadísticas del colegio.")
        }

        const students = (await studentsRes.json()) as Student[]
        const teachers = (await teachersRes.json()) as Teacher[]
        const groups = (await groupsRes.json()) as Group[]
        const sessions = attendanceRes.ok ? ((await attendanceRes.json()) as AttendanceSession[]) : []

        const allRecords = sessions.flatMap((session) => session.records)
        const presentCount = allRecords.filter(
          (record) => record.status === "PRESENT" || record.status === "LATE",
        ).length
        const attendanceToday = allRecords.length > 0 ? (presentCount / allRecords.length) * 100 : null

        if (!cancelled) {
          setStats({
            totalStudents: students.filter((s) => s.isActive).length,
            activeTeachers: teachers.filter((t) => t.user.status !== "INACTIVE").length,
            totalGroups: groups.length,
            attendanceToday,
          })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { stats, loading, error }
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "Justo ahora"
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

function actionIcon(action: string) {
  if (action.startsWith("student.")) return GraduationCap
  if (action.startsWith("mark.")) return BookOpen
  if (action.startsWith("attendance.") || action.startsWith("event.")) return Calendar
  return Users
}

const RECENT_ACTIVITY_TARGET = 5

function useRecentActivity() {
  const [activity, setActivity] = useState<AuditLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const usersRes = await apiFetch("/users", { silent: true })
        if (!cancelled) setUsers(usersRes.ok ? ((await usersRes.json()) as User[]) : [])

        // Session events (auth.*) dominate the raw log, so page through until
        // we have enough real institutional activity, capped to avoid over-fetching.
        const collected: AuditLog[] = []
        let cursor: string | undefined
        for (let page = 0; page < 4 && collected.length < RECENT_ACTIVITY_TARGET; page++) {
          const qs = new URLSearchParams({ limit: "20" })
          if (cursor) qs.set("cursor", cursor)
          const res = await apiFetch(`/audit/logs?${qs.toString()}`, { silent: true })
          if (!res.ok) throw new Error("No se pudo cargar la actividad reciente.")
          const data = (await res.json()) as AuditLogsResponse
          collected.push(...data.items.filter((item) => isInstitutionalAction(item.action)))
          if (!data.pageInfo.hasNextPage || !data.pageInfo.nextCursor) break
          cursor = data.pageInfo.nextCursor
        }

        if (!cancelled) setActivity(collected.slice(0, RECENT_ACTIVITY_TARGET))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { activity, users, loading, error }
}

function useUpcomingEvents() {
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const res = await apiFetch("/events?limit=3", { silent: true })
        if (!res.ok) throw new Error("No se pudieron cargar los próximos eventos.")
        const data = (await res.json()) as SchoolEvent[]
        if (!cancelled) setEvents(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
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

export default function AdminDashboardPage() {
  const { stats, loading: statsLoading, error: statsError } = useDashboardStats()
  const { activity, users: activityUsers, loading: activityLoading, error: activityError } = useRecentActivity()
  const activityUserById = new Map(activityUsers.map((u) => [u.id, u]))
  const { events, loading: eventsLoading, error: eventsError } = useUpcomingEvents()

  const statCards = stats
    ? [
        { title: "Total Estudiantes", value: String(stats.totalStudents), icon: GraduationCap },
        { title: "Profesores Activos", value: String(stats.activeTeachers), icon: Users },
        { title: "Cursos Activos", value: String(stats.totalGroups), icon: BookOpen },
        {
          title: "Asistencia Hoy",
          value: stats.attendanceToday === null ? "Sin registros" : `${stats.attendanceToday.toFixed(1)}%`,
          icon: AlertCircle,
        },
      ]
    : []

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Panel de Administración
        </h1>
        <p className="mt-1 text-muted-foreground">
          Bienvenido de vuelta. Aquí está el resumen de tu institución.
        </p>
      </div>

      {/* Stats Grid */}
      {statsError ? (
        <Card className="mb-8 border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">{statsError}</CardContent>
        </Card>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <Skeleton className="mt-4 h-7 w-16" />
                    <Skeleton className="mt-2 h-4 w-28" />
                  </CardContent>
                </Card>
              ))
            : statCards.map((stat) => (
                <Card key={stat.title}>
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                      <stat.icon className="h-6 w-6 text-foreground" />
                    </div>
                    <div className="mt-4">
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Actividad Reciente</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/actividad" className="gap-1">
                Ver todo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activityError ? (
              <p className="py-6 text-center text-sm text-destructive">{activityError}</p>
            ) : activityLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todavía no hay actividad registrada.
              </p>
            ) : (
              <div className="space-y-4">
                {activity.map((entry) => {
                  const Icon = actionIcon(entry.action)
                  const actor = entry.userId ? activityUserById.get(entry.userId) : undefined
                  const actorName = actor ? `${actor.firstName} ${actor.lastName}` : "Alguien"
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-4 rounded-lg border border-border p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {actorName} {humanizeAuditAction(entry.action)}
                        </p>
                        <p className="text-xs text-muted-foreground">{relativeTime(entry.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Próximos Eventos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/calendario" className="gap-1">
                Ver calendario
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {eventsError ? (
              <p className="py-6 text-center text-sm text-destructive">{eventsError}</p>
            ) : eventsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay eventos programados.
              </p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => {
                  const eventDate = new Date(event.date)
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 rounded-lg border border-border p-4"
                    >
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <span className="text-xs font-medium">
                          {eventDate.toLocaleDateString("es-CO", { day: "2-digit" })}
                        </span>
                        <span className="text-xs">
                          {eventDate.toLocaleDateString("es-CO", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {eventDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/estudiantes?new=1">Agregar Estudiante</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/profesores?new=1">Agregar Profesor</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/cursos?new=1">Crear Curso</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/mensajes/nuevo">Enviar Mensaje</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/reportes">Generar Reporte</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
