"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BookOpen, Calendar as CalendarIcon, Clock, Loader2, MapPin, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"

export interface ScheduleItem {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
  group: { id: string; name: string; grade: string | null; section: string | null }
  subject: { id: string; name: string; code: string | null }
  teacher: { id: string; user: { firstName: string; lastName: string } | null } | null
}

interface OwnStudent {
  id: string
  firstName: string
  lastName: string
  group: { id: string; name: string } | null
}

type ViewMode = "week" | "day"

interface Props {
  title: string
  description: string
  /**
   * Qué acompaña al nombre de la materia en cada bloque. La familia y el alumno quieren saber
   * quién dicta; el profesor ya lo sabe y lo que necesita es a qué curso entra.
   */
  secondary: "teacher" | "group"
  /** Selector de hijo. Solo la familia puede tener más de un estudiante a cargo. */
  withStudentPicker?: boolean
}

const WEEK_DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const WEEK_DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const SCHOOL_DAYS = [1, 2, 3, 4, 5]

// Paleta fija en vez de un color por materia guardado en la BD: `Subject` no tiene columna de
// color y agregarla es una decisión de producto. El índice sale del id, así que una materia
// conserva su color entre recargas y entre portales.
const PALETTE = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-amber-600",
]

function colorFor(subjectId: string) {
  let hash = 0
  for (let i = 0; i < subjectId.length; i++) hash = (hash * 31 + subjectId.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function minutesOf(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

export function PortalSchedulePage({ title, description, secondary, withStudentPicker = false }: Props) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [students, setStudents] = useState<OwnStudent[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedClass, setSelectedClass] = useState<ScheduleItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const requests: Promise<Response>[] = [apiFetch("/schedules/mine", { silent: true })]
      if (withStudentPicker) requests.push(apiFetch("/students/mine", { silent: true }))

      const [scheduleRes, studentsRes] = await Promise.all(requests)
      if (!scheduleRes.ok) throw new Error("No se pudo cargar el horario.")
      setSchedules((await scheduleRes.json()) as ScheduleItem[])

      if (studentsRes?.ok) {
        const own = (await studentsRes.json()) as OwnStudent[]
        setStudents(own)
        setSelectedStudentId((current) => current || own[0]?.id || "")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar.")
    } finally {
      setLoading(false)
    }
  }, [withStudentPicker])

  useEffect(() => {
    load()
  }, [load])

  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId],
  )

  /**
   * `/schedules/mine` devuelve la unión de los grupos del actor, así que un acudiente con dos
   * hijos en cursos distintos recibe las dos agendas mezcladas. Cada `Schedule` trae su grupo,
   * y `/students/mine` dice en qué grupo está cada hijo: con eso alcanza para separarlas sin
   * pedirle nada más al backend.
   */
  const visible = useMemo(() => {
    if (!activeStudent?.group) return schedules
    return schedules.filter((item) => item.group.id === activeStudent.group?.id)
  }, [schedules, activeStudent])

  const byDay = useMemo(() => {
    const map = new Map<number, ScheduleItem[]>()
    for (const item of visible) {
      const day = map.get(item.dayOfWeek)
      if (day) day.push(item)
      else map.set(item.dayOfWeek, [item])
    }
    for (const items of map.values()) {
      items.sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
    }
    return map
  }, [visible])

  // La grilla se ajusta a las clases que hay. Un rango fijo de 7 a 14 deja la jornada de la
  // tarde fuera de la vista sin decirlo, y en un colegio con una sola clase a las 10 pinta seis
  // franjas vacías.
  const [firstHour, lastHour] = useMemo(() => {
    if (visible.length === 0) return [7, 14]
    const starts = visible.map((item) => Math.floor(minutesOf(item.startTime) / 60))
    const ends = visible.map((item) => Math.ceil(minutesOf(item.endTime) / 60))
    return [Math.min(...starts), Math.max(...ends)]
  }, [visible])

  const hours = useMemo(
    () => Array.from({ length: Math.max(1, lastHour - firstHour) }, (_, i) => firstHour + i),
    [firstHour, lastHour],
  )

  const secondaryOf = useCallback(
    (item: ScheduleItem) => {
      if (secondary === "group") return item.group.name
      const user = item.teacher?.user
      return user ? `${user.firstName} ${user.lastName}` : "Sin profesor asignado"
    },
    [secondary],
  )

  const today = new Date().getDay()
  const todayClasses = byDay.get(today) ?? []

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">{title}</h1>
            <p className="mt-1 text-muted-foreground">
              {activeStudent
                ? `${activeStudent.firstName} ${activeStudent.lastName}${
                    activeStudent.group ? ` — ${activeStudent.group.name}` : ""
                  }`
                : description}
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Card className="mb-6">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
              {students.length > 1 ? (
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
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Horario semanal
                </p>
              )}

              <div className="flex rounded-lg border border-input p-1">
                {(["week", "day"] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === "week" ? "Semana" : "Hoy"}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {!loading && visible.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-lg font-medium text-foreground">Sin horario</p>
                <p className="text-sm text-muted-foreground">
                  Todavía no hay clases asignadas.
                </p>
              </CardContent>
            </Card>
          )}

          {visible.length > 0 && viewMode === "week" && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Móvil: un día debajo del otro */}
                <div className="lg:hidden">
                  {SCHOOL_DAYS.map((dayIndex) => {
                    const dayClasses = byDay.get(dayIndex) ?? []
                    return (
                      <div key={dayIndex} className="border-b border-border last:border-0">
                        <div
                          className={`flex items-center gap-2 p-3 ${
                            dayIndex === today ? "bg-primary/5" : "bg-muted/50"
                          }`}
                        >
                          <span className="font-medium text-foreground">
                            {WEEK_DAYS_FULL[dayIndex]}
                          </span>
                          {dayIndex === today && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                              Hoy
                            </span>
                          )}
                        </div>
                        <div className="space-y-2 p-3">
                          {dayClasses.length > 0 ? (
                            dayClasses.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedClass(item)}
                                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-white ${colorFor(item.subject.id)}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{item.subject.name}</p>
                                  <p className="text-sm opacity-80">
                                    {item.startTime} - {item.endTime}
                                  </p>
                                </div>
                                <div className="text-right text-sm opacity-80">
                                  <p className="truncate">{item.room ?? secondaryOf(item)}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              Sin clases
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Escritorio: grilla horaria */}
                <div className="hidden lg:block">
                  <div className="grid grid-cols-6 border-b border-border">
                    <div className="p-2" />
                    {SCHOOL_DAYS.map((dayIndex) => (
                      <div key={dayIndex} className="border-l border-border p-2 text-center">
                        <p className="text-xs text-muted-foreground">{WEEK_DAYS_SHORT[dayIndex]}</p>
                        <p
                          className={`text-sm font-semibold ${
                            dayIndex === today ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {WEEK_DAYS_FULL[dayIndex]}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="max-h-[560px] overflow-y-auto">
                    <div className="grid grid-cols-6">
                      <div>
                        {hours.map((hour) => (
                          <div key={hour} className="h-20 border-b border-border px-2 py-1">
                            <span className="text-xs text-muted-foreground">
                              {String(hour).padStart(2, "0")}:00
                            </span>
                          </div>
                        ))}
                      </div>

                      {SCHOOL_DAYS.map((dayIndex) => (
                        <div key={dayIndex} className="relative border-l border-border">
                          {hours.map((hour) => (
                            <div key={hour} className="h-20 border-b border-border" />
                          ))}
                          {(byDay.get(dayIndex) ?? []).map((item) => {
                            const top = ((minutesOf(item.startTime) - firstHour * 60) / 60) * 80
                            const height =
                              ((minutesOf(item.endTime) - minutesOf(item.startTime)) / 60) * 80

                            return (
                              <button
                                key={item.id}
                                onClick={() => setSelectedClass(item)}
                                className={`absolute left-1 right-1 overflow-hidden rounded p-2 text-left text-white ${colorFor(item.subject.id)}`}
                                style={{ top: `${top}px`, height: `${Math.max(height, 28)}px` }}
                              >
                                <p className="truncate text-sm font-medium">{item.subject.name}</p>
                                <p className="truncate text-xs opacity-80">
                                  {item.startTime} - {item.endTime}
                                </p>
                                <p className="truncate text-xs opacity-80">
                                  {item.room ?? secondaryOf(item)}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {visible.length > 0 && viewMode === "day" && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {todayClasses.length > 0 ? (
                    todayClasses.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedClass(item)}
                        className={`flex w-full items-center gap-4 rounded-lg p-4 text-left text-white ${colorFor(item.subject.id)}`}
                      >
                        <div className="text-center">
                          <p className="text-lg font-bold">{item.startTime}</p>
                          <p className="text-sm opacity-80">{item.endTime}</p>
                        </div>
                        <div className="h-12 w-px bg-white/30" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-semibold">{item.subject.name}</p>
                          <p className="truncate text-sm opacity-80">{secondaryOf(item)}</p>
                          {item.room && <p className="truncate text-sm opacity-80">{item.room}</p>}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-12 text-center">
                      <CalendarIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="text-lg font-medium text-foreground">Sin clases</p>
                      <p className="text-sm text-muted-foreground">
                        No hay clases programadas para hoy ({WEEK_DAYS_FULL[today].toLowerCase()}).
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {selectedClass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={() => setSelectedClass(null)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className={`${colorFor(selectedClass.subject.id)} rounded-t-lg text-white`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm opacity-80">Clase</p>
                  <CardTitle className="text-white">{selectedClass.subject.name}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => setSelectedClass(null)}
                >
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <BookOpen className="h-5 w-5 shrink-0" />
                <span>
                  {selectedClass.teacher?.user
                    ? `${selectedClass.teacher.user.firstName} ${selectedClass.teacher.user.lastName}`
                    : "Sin profesor asignado"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Users className="h-5 w-5 shrink-0" />
                <span>{selectedClass.group.name}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <CalendarIcon className="h-5 w-5 shrink-0" />
                <span>{WEEK_DAYS_FULL[selectedClass.dayOfWeek]}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5 shrink-0" />
                <span>
                  {selectedClass.startTime} - {selectedClass.endTime}
                </span>
              </div>
              {selectedClass.room && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5 shrink-0" />
                  <span>{selectedClass.room}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
