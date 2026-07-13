"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, BookOpen, ChevronRight, ClipboardCheck, ClipboardList, FileText, Users } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DAY_LABELS, type TeacherSchedule } from "@/components/profesor/marks-types"

type TeacherClass = {
  id: string
  group: TeacherSchedule["group"]
  subject: TeacherSchedule["subject"]
  schedules: TeacherSchedule[]
}

export default function MisClasesPage() {
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadSetup = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const bootstrapRes = await apiFetch("/app/bootstrap", { silent: true })
      if (!bootstrapRes.ok) throw new Error("No se pudo cargar tu perfil.")
      const bootstrap = (await bootstrapRes.json()) as {
        summary?: { kind?: string; teacher?: { id?: string } }
      }
      const id = bootstrap.summary?.teacher?.id
      if (!bootstrap.summary || bootstrap.summary.kind !== "teacher" || !id) {
        throw new Error("Esta cuenta no tiene un perfil de profesor asociado.")
      }

      const schedulesRes = await apiFetch(`/schedules?teacherId=${id}`, { silent: true })
      const schedulesData = schedulesRes.ok ? ((await schedulesRes.json()) as TeacherSchedule[]) : []
      setSchedules(schedulesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  const classes = useMemo(() => {
    const map = new Map<string, TeacherClass>()
    for (const s of schedules) {
      const key = `${s.group.id}-${s.subject.id}`
      if (!map.has(key)) {
        map.set(key, { id: key, group: s.group, subject: s.subject, schedules: [] })
      }
      map.get(key)!.schedules.push(s)
    }
    return Array.from(map.values()).sort((a, b) => a.group.name.localeCompare(b.group.name))
  }, [schedules])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Mis Clases</h1>
          <p className="mt-1 text-muted-foreground">Vista general de tus asignaturas y grupos asignados.</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : classes.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Aún no tienes clases asignadas</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Contacta a coordinación académica para que configuren tu carga horaria y grupos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader className="border-b border-border bg-muted/30 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">{cls.subject.name}</CardTitle>
                    <p className="mt-1 font-medium text-muted-foreground">{cls.group.name}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 py-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{cls.group.grade} - Sección {cls.group.section}</span>
                  </div>
                  
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horarios</p>
                    {cls.schedules.sort((a,b) => a.dayOfWeek - b.dayOfWeek).map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md bg-secondary px-3 py-1.5 text-sm">
                        <span className="font-medium text-foreground">{DAY_LABELS[s.dayOfWeek]}</span>
                        <span className="text-muted-foreground">{s.startTime} - {s.endTime}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="grid grid-cols-3 gap-2 border-t border-border pt-4">
                <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto py-2 px-1 text-xs" asChild>
                  <Link href={`/profesor/asignaciones?scheduleId=${cls.schedules[0].id}`}>
                    <FileText className="h-4 w-4" />
                    <span className="truncate w-full text-center">Tareas</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto py-2 px-1 text-xs" asChild>
                  <Link href={`/profesor/calificaciones?scheduleId=${cls.schedules[0].id}`}>
                    <ClipboardList className="h-4 w-4" />
                    <span className="truncate w-full text-center">Notas</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto py-2 px-1 text-xs" asChild>
                  <Link href={`/profesor/asistencia?scheduleId=${cls.schedules[0].id}`}>
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="truncate w-full text-center">Lista</span>
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
