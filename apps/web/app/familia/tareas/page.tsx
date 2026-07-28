"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Download,
  ChevronRight,
  BookOpen,
  Filter,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"

/** Estado derivado: `Homework` no lo guarda, sale de cruzar la entrega con la fecha límite. */
type TaskStatus = "pendiente" | "entregada" | "calificada" | "atrasada"

interface OwnStudent {
  id: string
  firstName: string
  lastName: string
  group: { id: string; name: string } | null
}

interface Homework {
  id: string
  title: string
  description: string | null
  dueDate: string
  type: string | null
  group: { id: string; name: string }
  subject: { id: string; name: string }
  teacher: { id: string; user: { firstName: string; lastName: string } | null } | null
  /** El enunciado que sube el profesor -- no confundir con el archivo que entrega el alumno. */
  attachmentKey: string | null
  attachmentName: string | null
}

interface Submission {
  id: string
  studentId: string
  status: string
  submittedAt: string | null
  feedbackComment: string | null
  gradedAt: string | null
  attachmentName: string | null
  attachmentUrl: string | null
  feedbackUrl: string | null
}

const STATUS_META: Record<TaskStatus, { label: string; badge: string; icon: typeof FileText }> = {
  pendiente: { label: "Pendiente", badge: "bg-blue-100 text-blue-800", icon: FileText },
  entregada: { label: "Entregada", badge: "bg-amber-100 text-amber-800", icon: CheckCircle2 },
  calificada: { label: "Calificada", badge: "bg-green-100 text-green-800", icon: CheckCircle2 },
  atrasada: { label: "Atrasada", badge: "bg-red-100 text-red-800", icon: AlertCircle },
}

const STATUS_FILTERS: (TaskStatus | "Todos")[] = [
  "Todos",
  "pendiente",
  "entregada",
  "calificada",
  "atrasada",
]

/**
 * `PENDING` no se usa: ningún camino del backend crea una entrega sin estado explícito, así que
 * "no entregó" se deriva de que no haya fila, no de un estado fantasma
 * (docs/planning/asignaciones-calificacion-en-linea.md §5).
 */
function statusOf(homework: Homework, submission: Submission | null | undefined): TaskStatus {
  if (submission?.status === "GRADED") return "calificada"
  if (submission) return "entregada"
  return new Date(homework.dueDate).getTime() < Date.now() ? "atrasada" : "pendiente"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function TareasFamiliaPage() {
  const [students, setStudents] = useState<OwnStudent[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [homework, setHomework] = useState<Homework[]>([])
  const [submissions, setSubmissions] = useState<Record<string, Submission | null>>({})
  const [selectedSubject, setSelectedSubject] = useState("Todos")
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | "Todos">("Todos")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [downloadingAttachment, setDownloadingAttachment] = useState(false)

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

  const load = useCallback(async (student: OwnStudent) => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/homework", { silent: true })
      if (!res.ok) throw new Error("No se pudieron cargar las tareas.")
      const all = (await res.json()) as Homework[]

      // `/homework` devuelve las tareas de los grupos de TODOS los hijos: un acudiente con dos
      // hijos en cursos distintos recibe las dos listas mezcladas.
      const mine = student.group ? all.filter((h) => h.group.id === student.group?.id) : all
      setHomework(mine)

      // Una consulta por tarea porque `GET /homework` no trae la entrega, y sin ella la lista
      // no puede distinguir "pendiente" de "entregada" — que es justo lo que la familia entra a
      // mirar. Si el volumen llegara a doler, lo correcto es que /homework acepte ?studentId= y
      // la traiga embebida, no cachear acá.
      const entries = await Promise.all(
        mine.map(async (item) => {
          const submissionRes = await apiFetch(
            `/homework/${item.id}/submissions/by-student/${student.id}`,
            { silent: true },
          )
          if (!submissionRes.ok) return [item.id, null] as const
          // "Sin entrega" viaja como 200 con cuerpo vacío, no como null serializado, así que
          // .json() directo lanza "Unexpected end of JSON input" y tumbaría toda la lista.
          // Mismo tratamiento que hace /alumno/tarea con submissions/me.
          const text = await submissionRes.text()
          return [item.id, text ? (JSON.parse(text) as Submission) : null] as const
        }),
      )
      setSubmissions(Object.fromEntries(entries))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las tareas.")
      setHomework([])
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * El acudiente no tiene FILES_READ (backlog "Seguridad y Permisos" 2.1), así
   * que no puede resolver la key del adjunto por su cuenta -- pide una URL
   * firmada al endpoint dueño del dato, que valida que este hijo tenga tarea
   * en ese curso antes de firmarla (GET /homework/:id/attachment-url).
   */
  const handleDownloadAttachment = useCallback(async (homeworkId: string) => {
    setDownloadingAttachment(true)
    try {
      const res = await apiFetch(`/homework/${homeworkId}/attachment-url`, { silent: true })
      if (!res.ok) throw new Error("No se pudo obtener el enunciado.")
      const data = (await res.json()) as { url: string; name: string | null }
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el enunciado.")
    } finally {
      setDownloadingAttachment(false)
    }
  }, [])

  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId],
  )

  useEffect(() => {
    if (activeStudent) load(activeStudent)
  }, [activeStudent, load])

  const subjects = useMemo(() => {
    const names = new Set(homework.map((item) => item.subject.name))
    return ["Todos", ...Array.from(names).sort()]
  }, [homework])

  const filtered = useMemo(() => {
    return homework
      .filter((item) => selectedSubject === "Todos" || item.subject.name === selectedSubject)
      .filter(
        (item) =>
          selectedStatus === "Todos" || statusOf(item, submissions[item.id]) === selectedStatus,
      )
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
  }, [homework, submissions, selectedSubject, selectedStatus])

  const counts = useMemo(() => {
    const result = { pendiente: 0, entregada: 0, calificada: 0, atrasada: 0 }
    for (const item of homework) result[statusOf(item, submissions[item.id])]++
    return result
  }, [homework, submissions])

  const selectedTask = selectedTaskId ? homework.find((h) => h.id === selectedTaskId) : null
  const selectedSubmission = selectedTaskId ? submissions[selectedTaskId] : null

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Tareas</h1>
            <p className="mt-1 text-muted-foreground">
              {activeStudent
                ? `${activeStudent.firstName} ${activeStudent.lastName}${
                    activeStudent.group ? ` — ${activeStudent.group.name}` : ""
                  }`
                : "Asignaciones y entregas"}
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {(students.length > 1 || showFilters) && (
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
              {students.length > 1 && (
                <div className="w-full space-y-2 sm:w-56">
                  <Label>Estudiante</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showFilters && (
                <>
                  <div className="w-full space-y-2 sm:w-48">
                    <Label>Materia</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full space-y-2 sm:w-48">
                    <Label>Estado</Label>
                    <Select
                      value={selectedStatus}
                      onValueChange={(value) => setSelectedStatus(value as TaskStatus | "Todos")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_FILTERS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status === "Todos" ? "Todos" : STATUS_META[status].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(Object.keys(STATUS_META) as TaskStatus[]).map((status) => (
            <Card key={status}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground">{counts[status]}</p>
                <p className="text-xs text-muted-foreground">{STATUS_META[status].label}s</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando tareas…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium text-foreground">Sin tareas</p>
              <p className="text-sm text-muted-foreground">
                {homework.length === 0
                  ? "Todavía no hay asignaciones para este curso."
                  : "Ninguna tarea coincide con los filtros."}
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((item) => {
              const status = statusOf(item, submissions[item.id])
              const meta = STATUS_META[status]
              const Icon = meta.icon

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedTaskId(item.id)}
                  className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.subject.name}
                      {item.teacher?.user
                        ? ` · ${item.teacher.user.firstName} ${item.teacher.user.lastName}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Entrega: {formatDate(item.dueDate)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={() => setSelectedTaskId(null)}
        >
          <Card
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{selectedTask.subject.name}</p>
                  <CardTitle>{selectedTask.title}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTaskId(null)}>
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedTask.description && (
                <p className="whitespace-pre-line text-sm text-foreground">
                  {selectedTask.description}
                </p>
              )}

              {selectedTask.attachmentKey && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={downloadingAttachment}
                  onClick={() => handleDownloadAttachment(selectedTask.id)}
                >
                  {downloadingAttachment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {selectedTask.attachmentName ?? "Descargar enunciado"}
                </Button>
              )}

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Entrega: {formatDate(selectedTask.dueDate)}</span>
              </div>
              {selectedTask.teacher?.user && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>
                    {selectedTask.teacher.user.firstName} {selectedTask.teacher.user.lastName}
                  </span>
                </div>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Entrega</p>
                {selectedSubmission ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {selectedSubmission.submittedAt
                        ? `Entregado el ${formatDate(selectedSubmission.submittedAt)}`
                        : "Sin archivo entregado"}
                    </p>
                    {selectedSubmission.attachmentUrl && (
                      <a
                        href={selectedSubmission.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        {selectedSubmission.attachmentName ?? "Descargar entrega"}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Todavía no hay una entrega.</p>
                )}
              </div>

              {(selectedSubmission?.feedbackComment || selectedSubmission?.feedbackUrl) && (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground">Retroalimentación</p>
                  {selectedSubmission.feedbackComment && (
                    <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-sm text-foreground">
                      {selectedSubmission.feedbackComment}
                    </p>
                  )}
                  {selectedSubmission.feedbackUrl && (
                    <a
                      href={selectedSubmission.feedbackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      Descargar trabajo corregido
                    </a>
                  )}
                  {/* La nota vive en Calificaciones y no se duplica acá: el boletín es el dueño
                      de ese dato y mostrarlo en dos lados invita a que se desincronicen. */}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
