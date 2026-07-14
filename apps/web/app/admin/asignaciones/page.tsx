"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, FileText } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeacherCombobox } from "@/components/admin/teacher-combobox"
import { AssignmentCard } from "@/components/shared/assignment-card"
import { AttachmentPreviewDialog } from "@/components/shared/attachment-preview-dialog"
import { HOMEWORK_TYPES, type Homework } from "@/components/profesor/homework-types"
import type { Teacher } from "@/components/admin/academic-types"

const FILTERS = ["ALL", ...HOMEWORK_TYPES] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  ALL: "Todas",
  TAREA: "Tareas",
  EXAMEN: "Exámenes",
  QUIZ: "Quices",
  PROYECTO: "Proyectos",
}

export default function AdminAsignacionesPage() {
  const [homeworkList, setHomeworkList] = useState<Homework[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("ALL")
  const [preview, setPreview] = useState<{ key: string; name: string } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [homeworkRes, teachersRes] = await Promise.all([
        apiFetch("/homework", { silent: true }),
        apiFetch("/teachers", { silent: true }),
      ])

      if (!homeworkRes.ok) {
        throw new Error(homeworkRes.status === 403 ? "No tienes permiso para ver las asignaciones." : "No se pudieron cargar las asignaciones.")
      }

      setHomeworkList(((await homeworkRes.json()) as Homework[]) ?? [])
      setTeachers(teachersRes.ok ? (((await teachersRes.json()) as Teacher[]) ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setHomeworkList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const visibleHomework = useMemo(() => {
    let list = homeworkList
    if (selectedTeacherId) list = list.filter((h) => h.teacher?.id === selectedTeacherId)
    if (filter !== "ALL") list = list.filter((h) => h.type === filter)
    return [...list].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [homeworkList, selectedTeacherId, filter])

  function openAttachment(key: string, name?: string | null) {
    setPreview({ key, name: name ?? "Archivo" })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asignaciones</h1>
        <p className="mt-1 text-muted-foreground">Consulta las tareas, exámenes, quices y proyectos creados por los profesores.</p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="p-4">
          <Label>Profesor</Label>
          <div className="mt-2 w-full sm:w-72">
            <TeacherCombobox teachers={teachers} value={selectedTeacherId} onChange={setSelectedTeacherId} allowAll />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="gap-3 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              {FILTER_LABELS[filter]} ({loading ? "…" : visibleHomework.length})
            </CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                {FILTERS.map((f) => (
                  <TabsTrigger key={f} value={f}>
                    {FILTER_LABELS[f]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : visibleHomework.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">No hay asignaciones para estos filtros</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {homeworkList.length === 0 ? "Los profesores aún no han creado asignaciones." : "Ajusta los filtros para ver otras."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleHomework.map((homework) => (
            <AssignmentCard
              key={homework.id}
              homework={homework}
              onAttachmentClick={openAttachment}
              showTeacher
              showGroup
            />
          ))}
        </div>
      )}

      <AttachmentPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
        fileKey={preview?.key ?? null}
        fileName={preview?.name}
      />
    </div>
  )
}
