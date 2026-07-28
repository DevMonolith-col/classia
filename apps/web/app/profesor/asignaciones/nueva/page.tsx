"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useTeacherId } from "@/lib/bootstrap"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HomeworkEditor } from "@/components/profesor/homework-editor"
import { DAY_LABELS, type TeacherSchedule } from "@/components/profesor/marks-types"

function NuevaAsignacionPageContent() {
  const searchParams = useSearchParams()
  const scheduleIdParam = searchParams.get("scheduleId")

  const { teacherId, loading: teacherLoading, error: teacherError } = useTeacherId()
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedScheduleId, setSelectedScheduleId] = useState(scheduleIdParam ?? "")

  useEffect(() => {
    if (teacherLoading) return
    if (teacherError) {
      setError(teacherError)
      setLoading(false)
      return
    }
    if (!teacherId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const schedulesRes = await apiFetch(`/schedules?teacherId=${teacherId}`, { silent: true })
        const schedulesData = schedulesRes.ok ? ((await schedulesRes.json()) as TeacherSchedule[]) : []
        if (cancelled) return
        setSchedules(schedulesData)
        if (!scheduleIdParam && schedulesData.length > 0) setSelectedScheduleId(schedulesData[0].id)
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
  }, [teacherId, teacherLoading, teacherError, scheduleIdParam])

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId) ?? null

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Aún no tienes clases asignadas. Pide a la administración que te asigne horarios.</p>
        </div>
      </div>
    )
  }

  if (!selectedSchedule) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">Nueva asignación</h1>
        <Card>
          <CardContent className="p-6">
            <Label>Clase</Label>
            <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue placeholder="Selecciona una clase" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((schedule) => (
                  <SelectItem key={schedule.id} value={schedule.id}>
                    {DAY_LABELS[schedule.dayOfWeek]} {schedule.startTime}-{schedule.endTime} · {schedule.group.name} ·{" "}
                    {schedule.subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <HomeworkEditor mode="create" schedule={selectedSchedule} />
}

export default function NuevaAsignacionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
          <div className="h-64 animate-pulse rounded-lg bg-secondary" />
        </div>
      }
    >
      <NuevaAsignacionPageContent />
    </Suspense>
  )
}
