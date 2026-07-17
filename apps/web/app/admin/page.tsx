"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Users,
  GraduationCap,
  BookOpen,
  AlertCircle,
  Calendar,
  ArrowRight,
  Plus,
  MessageSquare,
  TrendingDown,
  BellRing,
  ArrowUpRight,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"
import type { Student } from "@/components/admin/student-types"
import type { Teacher, Group } from "@/components/admin/academic-types"

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
    return () => { cancelled = true }
  }, [])

  return { stats, loading, error }
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
        const res = await apiFetch("/events?limit=4", { silent: true })
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
    return () => { cancelled = true }
  }, [])

  return { events, loading, error }
}

export default function AdminDashboardPage() {
  const { stats, loading: statsLoading, error: statsError } = useDashboardStats()
  const { events, loading: eventsLoading, error: eventsError } = useUpcomingEvents()

  const statCards = stats
    ? [
        { title: "Estudiantes Activos", value: String(stats.totalStudents), icon: GraduationCap, href: "/admin/estudiantes", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40" },
        { title: "Personal Docente", value: String(stats.activeTeachers), icon: Users, href: "/admin/profesores", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40" },
        { title: "Grupos / Cursos", value: String(stats.totalGroups), icon: BookOpen, href: "/admin/cursos", color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/40" },
        {
          title: "Asistencia Global Hoy",
          value: stats.attendanceToday === null ? "—" : `${stats.attendanceToday.toFixed(0)}%`,
          icon: AlertCircle,
          href: "/admin/asistencia",
          color: stats.attendanceToday !== null && stats.attendanceToday >= 80
            ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40"
            : "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Centro de Control Escolar</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Inicio</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/estudiantes?new=1" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Matricular
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/mensajes/nuevo" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Comunicado
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        {/* Stats Row */}
        {statsError ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {statsError}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="shadow-sm">
                    <CardContent className="flex items-center gap-3 p-4">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-6 w-12" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              : statCards.map((stat) => (
                  <Link key={stat.title} href={stat.href}>
                    <Card className="shadow-sm transition-shadow hover:shadow-md cursor-pointer">
                      <CardContent className="flex items-center gap-4 p-5">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.color}`}>
                          <stat.icon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
                          <p className="mt-1 text-sm font-medium text-muted-foreground">{stat.title}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            
            {/* Triage / Alertas Urgentes */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                <BellRing className="h-4 w-4 text-amber-500" /> Novedades Urgentes
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="shadow-sm border-l-4 border-l-muted hover:bg-secondary/10 transition-colors">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
                    <BellRing className="h-6 w-6 mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No hay novedades urgentes</p>
                    <p className="text-xs mt-1">Todo está en orden en este momento.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Grupos con peor asistencia */}
            <Card className="shadow-sm flex flex-col">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-500" /> Grupos con baja asistencia (Hoy)
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                  <Link href="/admin/asistencia">Ver reporte completo</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <TrendingDown className="h-6 w-6 mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-medium">Asistencia normal</p>
                    <p className="text-xs mt-1">Ningún grupo presenta inasistencias por debajo del umbral de alerta hoy.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Upcoming Events sidebar */}
          <Card className="h-fit shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Próximos eventos</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" asChild>
                <Link href="/admin/calendario">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {eventsError ? (
                <p className="py-4 text-center text-sm text-destructive">{eventsError}</p>
              ) : eventsLoading ? (
                <div className="space-y-3 mt-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Calendar className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Sin eventos programados</p>
                </div>
              ) : (
                <div className="relative space-y-4 mt-2">
                  {events.map((event) => {
                    const eventDate = new Date(event.date)
                    return (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-sm">
                          <span className="text-sm font-bold leading-none">
                            {eventDate.toLocaleDateString("es-CO", { day: "2-digit" })}
                          </span>
                          <span className="text-[10px] uppercase font-semibold leading-none mt-1">
                            {eventDate.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
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
      </div>
    </div>
  )
}
