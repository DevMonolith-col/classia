"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Users,
  BookOpen,
  ClipboardList,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import type { Schedule } from "@/components/admin/academic-types"
import type { Homework, HomeworkSubmission } from "@/components/profesor/homework-types"
import type { Student } from "@/components/admin/student-types"

type PendingGradingItem = { homework: Homework; pendingCount: number }

type ProfesorDashboardData = {
  todaySchedule: Schedule[]
  totalSchedules: number
  studentsCount: number
  groupsCount: number
  pendingGrading: PendingGradingItem[]
  attendanceAvgPercent: number | null
}

function useProfesorDashboard() {
  const [data, setData] = useState<ProfesorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const bootstrapRes = await apiFetch("/app/bootstrap", { silent: true })
        if (!bootstrapRes.ok) throw new Error("No se pudo cargar tu perfil de profesor.")
        const bootstrap = (await bootstrapRes.json()) as {
          summary?: { kind?: string; teacher?: { id?: string } }
        }
        const teacherId = bootstrap.summary?.teacher?.id
        if (!bootstrap.summary || bootstrap.summary.kind !== "teacher" || !teacherId) {
          throw new Error("Esta cuenta no tiene un perfil de profesor asociado.")
        }

        const from = new Date()
        from.setDate(from.getDate() - 30)

        const [schedulesRes, homeworkRes, attendanceRes] = await Promise.all([
          apiFetch(`/schedules?teacherId=${teacherId}`, { silent: true }),
          apiFetch("/homework", { silent: true }),
          apiFetch(`/attendance/sessions?from=${from.toISOString()}`, { silent: true }),
        ])

        const schedules = schedulesRes.ok ? ((await schedulesRes.json()) as Schedule[]) : []
        const homework = homeworkRes.ok ? ((await homeworkRes.json()) as Homework[]) : []
        const sessions = attendanceRes.ok
          ? ((await attendanceRes.json()) as { records: { status: string }[] }[])
          : []

        const today = new Date().getDay()
        const todaySchedule = schedules
          .filter((s) => s.dayOfWeek === today)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))

        const groupIds = [...new Set(schedules.map((s) => s.group.id))]
        const studentsByGroup = await Promise.all(
          groupIds.map(async (groupId) => {
            const res = await apiFetch(`/students?groupId=${groupId}`, { silent: true })
            return res.ok ? ((await res.json()) as Student[]) : []
          }),
        )
        const uniqueStudentIds = new Set(studentsByGroup.flat().map((s) => s.id))

        const gradableHomework = homework.filter(
          (h) => h.type !== "QUIZ" && (h._count?.submissions ?? 0) > 0,
        )
        const pendingResults = await Promise.all(
          gradableHomework.map(async (h) => {
            const res = await apiFetch(`/homework/${h.id}/submissions`, { silent: true })
            if (!res.ok) return { homework: h, pendingCount: 0 }
            const submissions = (await res.json()) as HomeworkSubmission[]
            const pendingCount = submissions.filter(
              (s) => s.status === "SUBMITTED" || s.status === "LATE",
            ).length
            return { homework: h, pendingCount }
          }),
        )
        const pendingGrading = pendingResults.filter((r) => r.pendingCount > 0)

        const allRecords = sessions.flatMap((s) => s.records)
        const present = allRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length
        const attendanceAvgPercent = allRecords.length > 0 ? (present / allRecords.length) * 100 : null

        if (!cancelled) {
          setData({
            todaySchedule,
            totalSchedules: schedules.length,
            studentsCount: uniqueStudentIds.size,
            groupsCount: groupIds.length,
            pendingGrading,
            attendanceAvgPercent,
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

  return { data, loading, error }
}

function classStatus(startTime: string, endTime: string): "completed" | "current" | "upcoming" {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const [startH, startM] = startTime.split(":").map(Number)
  const [endH, endM] = endTime.split(":").map(Number)
  const start = startH * 60 + startM
  const end = endH * 60 + endM
  if (nowMinutes >= end) return "completed"
  if (nowMinutes >= start) return "current"
  return "upcoming"
}

export default function ProfesorDashboardPage() {
  const { data, loading, error } = useProfesorDashboard()

  const stats = data
    ? [
        { title: "Clases Hoy", value: String(data.todaySchedule.length), subtitle: `de ${data.totalSchedules} totales`, icon: BookOpen },
        { title: "Estudiantes", value: String(data.studentsCount), subtitle: `en ${data.groupsCount} grupos`, icon: Users },
        {
          title: "Tareas Pendientes",
          value: String(data.pendingGrading.reduce((sum, p) => sum + p.pendingCount, 0)),
          subtitle: "por calificar",
          icon: ClipboardList,
        },
        {
          title: "Asistencia Promedio",
          value: data.attendanceAvgPercent === null ? "Sin registros" : `${data.attendanceAvgPercent.toFixed(0)}%`,
          subtitle: "últimos 30 días",
          icon: CheckCircle2,
        },
      ]
    : []

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Panel del Profesor</h1>
        <p className="mt-1 text-muted-foreground">
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          {data && ` • Tienes ${data.todaySchedule.length} clase${data.todaySchedule.length === 1 ? "" : "s"} programada${data.todaySchedule.length === 1 ? "" : "s"} para hoy`}
        </p>
      </div>

      {/* Stats Grid */}
      {error ? (
        <Card className="mb-8 border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <Skeleton className="mt-3 h-6 w-14" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </CardContent>
                </Card>
              ))
            : stats.map((stat) => (
                <Card key={stat.title}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                        <stat.icon className="h-6 w-6 text-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.title}</p>
                        <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horario de Hoy
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profesor/horario" className="gap-1">
                Ver completo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !data || data.todaySchedule.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No tienes clases hoy.</p>
            ) : (
              <div className="space-y-3">
                {data.todaySchedule.map((clase) => {
                  const status = classStatus(clase.startTime, clase.endTime)
                  return (
                    <div
                      key={clase.id}
                      className={`flex items-center gap-4 rounded-lg border p-4 ${
                        status === "current" ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="text-center">
                        <p
                          className={`text-sm font-medium ${
                            status === "completed" ? "text-muted-foreground line-through" : "text-foreground"
                          }`}
                        >
                          {clase.startTime}
                        </p>
                        <p className="text-xs text-muted-foreground">{clase.endTime}</p>
                      </div>
                      <div className="h-12 w-px bg-border" />
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            status === "completed" ? "text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {clase.subject.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {clase.group.grade} {clase.group.section} • {clase.room ?? "Sin aula asignada"}
                        </p>
                      </div>
                      <div>
                        {status === "completed" && <CheckCircle2 className="h-5 w-5 text-success" />}
                        {status === "current" && (
                          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                            En curso
                          </span>
                        )}
                        {status === "upcoming" && <Clock className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tareas por Calificar
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profesor/asignaciones" className="gap-1">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !data || data.pendingGrading.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tienes entregas pendientes por calificar.
              </p>
            ) : (
              <div className="space-y-4">
                {data.pendingGrading.map(({ homework, pendingCount }) => (
                  <div
                    key={homework.id}
                    className="flex items-start justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{homework.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {homework.group.grade} {homework.group.section}
                      </p>
                      <div className="mt-2 flex items-center gap-4">
                        <span className="text-xs font-medium text-warning">
                          <AlertCircle className="mr-1 inline h-3 w-3" />
                          Venció: {new Date(homework.dueDate).toLocaleDateString("es-CO")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {pendingCount} sin calificar
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/profesor/asignaciones/${homework.id}`}>Calificar</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mensajes Recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profesor/mensajes" className="gap-1">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm font-medium text-foreground">Próximamente</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                La mensajería entre profesores, acudientes y administración está en construcción en otra rama del equipo.
              </p>
            </div>
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
              <Link href="/profesor/calificaciones">Registrar Calificaciones</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profesor/asignaciones/nueva">Crear Tarea</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profesor/estudiantes">Ver Estudiantes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profesor/mensajes/nuevo">Enviar Mensaje</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
