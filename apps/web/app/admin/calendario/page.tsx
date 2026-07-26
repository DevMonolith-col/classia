"use client"

// Calendario del colegio. Antes del 2026-07-26 esta página era una maqueta: `mockEvents` con
// diez eventos de febrero de 2024, "hoy" congelado en el 12 de ese mes y los botones sin
// `onClick`. Ahora consume el módulo `events` real (Fase 2 de docs/planning/calendario.md).
//
// La grilla vive en components/shared/calendar: la van a reusar /familia/calendario,
// /profesor/calendario y /alumno/calendario en la Fase 4.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Calendar as CalendarIcon,
  CalendarOff,
  CalendarPlus,
  Clock,
  GraduationCap,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CalendarGrid, monthRange, type CalendarViewMode } from "@/components/shared/calendar/calendar-grid"
import {
  type CalendarEvent,
  type CalendarEventType,
  EVENT_TYPES,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  TARGET_ROLE_LABELS,
  formatEventRange,
} from "@/components/shared/calendar/calendar-types"
import { CalendarSubscribeDialog } from "@/components/shared/calendar/subscribe-dialog"
import { EventFormDialog } from "@/components/admin/event-form-dialog"
import type { Group } from "@/components/admin/academic-types"

type TypeFilter = CalendarEventType | "Todos"

/** Rango que cubre la vista actual, con margen para las filas de días vecinos. */
function rangeForView(date: Date, viewMode: CalendarViewMode) {
  if (viewMode === "month") return monthRange(date)
  const from = new Date(date)
  from.setDate(date.getDate() - date.getDay() - 1)
  const to = new Date(from)
  to.setDate(from.getDate() + 9)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export default function CalendarioAdminPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month")
  const [selectedType, setSelectedType] = useState<TypeFilter>("Todos")

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [defaultDay, setDefaultDay] = useState<Date | null>(null)
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  // El título se guarda aparte porque Radix mantiene el diálogo montado durante la animación
  // de salida: al limpiar `deleting` tras borrar, el título alcanzaba a mostrarse como «»
  // mientras se desvanecía.
  const [deletingTitle, setDeletingTitle] = useState("")
  const [subscribeOpen, setSubscribeOpen] = useState(false)

  // La clave del rango va en las dependencias en vez de `currentDate`: navegar del 3 al 10
  // de agosto no cambia el mes consultado, y sin esto cada clic dispararía un fetch nuevo.
  const { from, to } = useMemo(
    () => rangeForView(currentDate, viewMode),
    [currentDate, viewMode],
  )
  const rangeKey = `${from.toISOString()}|${to.toISOString()}`

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [fromIso, toIso] = rangeKey.split("|")
      const res = await apiFetch(`/events?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, {
        silent: true,
      })
      if (!res.ok) throw new Error("No se pudieron cargar los eventos del calendario.")
      setEvents((await res.json()) as CalendarEvent[])
    } catch (err) {
      if (err instanceof ApiError) setError("No se pudo conectar con el servidor.")
      else setError(err instanceof Error ? err.message : "No se pudieron cargar los eventos.")
    } finally {
      setLoading(false)
    }
  }, [rangeKey])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    let cancelled = false
    async function loadGroups() {
      try {
        const res = await apiFetch("/groups", { silent: true })
        if (!res.ok) return
        const data = (await res.json()) as Group[]
        if (!cancelled) setGroups(data)
      } catch {
        // Los grupos solo alimentan el selector de audiencia: si fallan, el resto del
        // calendario sigue siendo usable y el formulario cae a "todo el colegio".
      }
    }
    loadGroups()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleEvents = useMemo(
    () => (selectedType === "Todos" ? events : events.filter((e) => e.type === selectedType)),
    [events, selectedType],
  )

  const stats = useMemo(() => {
    const inCurrentMonth = events.filter((e) => {
      const start = new Date(e.startsAt)
      return start.getMonth() === currentDate.getMonth() && start.getFullYear() === currentDate.getFullYear()
    })
    return {
      total: events.length,
      esteMes: inCurrentMonth.length,
      reuniones: events.filter((e) => e.type === "REUNION").length,
      noLectivos: events.filter((e) => e.isSchoolDayOff).length,
    }
  }, [events, currentDate])

  function upsertEvent(saved: CalendarEvent) {
    setEvents((current) => {
      const index = current.findIndex((e) => e.id === saved.id)
      if (index === -1) return [...current, saved]
      const next = [...current]
      next[index] = saved
      return next
    })
    setSelectedEvent((current) => (current?.id === saved.id ? saved : current))
  }

  function openCreate(day?: Date) {
    setEditing(null)
    setDefaultDay(day ?? null)
    setFormOpen(true)
  }

  function openEdit(event: CalendarEvent) {
    setEditing(event)
    setDefaultDay(null)
    setSelectedEvent(null)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      const res = await apiFetch(`/events/${deleting.id}`, { method: "DELETE", silent: true })
      if (!res.ok) throw new Error("No se pudo eliminar el evento.")
      setEvents((current) => current.filter((e) => e.id !== deleting.id))
      setSelectedEvent(null)
      toast.success("Evento eliminado", { description: deleting.title })
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el evento.")
    } finally {
      setDeleteBusy(false)
    }
  }

  const statCards = [
    { label: "Eventos en la vista", value: stats.total, icon: CalendarIcon, tint: "bg-primary/10 text-primary" },
    { label: "Este mes", value: stats.esteMes, icon: BarChart3, tint: "bg-blue-100 text-blue-600" },
    { label: "Reuniones", value: stats.reuniones, icon: Users, tint: "bg-purple-100 text-purple-600" },
    { label: "Días no lectivos", value: stats.noLectivos, icon: GraduationCap, tint: "bg-emerald-100 text-emerald-700" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Calendario Escolar</h1>
              <p className="mt-1 text-muted-foreground">
                Gestiona los eventos y actividades del año escolar
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setSubscribeOpen(true)}>
                <CalendarPlus className="h-4 w-4" />
                Suscribir a mi calendario
              </Button>
              <Button className="gap-2" onClick={() => openCreate()}>
                <Plus className="h-4 w-4" />
                Nuevo Evento
              </Button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.tint}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p>{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadEvents}>
                Reintentar
              </Button>
            </div>
          )}

          <Card className="mb-6">
            <CardContent className="flex flex-wrap gap-2 p-4">
              {(["Todos", ...EVENT_TYPES] as TypeFilter[]).map((type) => (
                <Button
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                >
                  {type === "Todos" ? "Todos" : EVENT_TYPE_LABELS[type]}
                </Button>
              ))}
            </CardContent>
          </Card>

          <CalendarGrid
            events={visibleEvents}
            currentDate={currentDate}
            viewMode={viewMode}
            onCurrentDateChange={setCurrentDate}
            onViewModeChange={setViewMode}
            onSelectEvent={setSelectedEvent}
            onSelectDay={openCreate}
            loading={loading}
          />

          {!loading && !error && visibleEvents.length === 0 && (
            <Card className="mt-6">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <CalendarIcon className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    {selectedType === "Todos"
                      ? "No hay eventos en este rango"
                      : `No hay eventos de tipo ${EVENT_TYPE_LABELS[selectedType]} en este rango`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Haz clic en cualquier día de la grilla para crear uno.
                  </p>
                </div>
                <Button className="gap-2" onClick={() => openCreate()}>
                  <Plus className="h-4 w-4" />
                  Nuevo Evento
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="mt-6 lg:hidden">
            <CardHeader>
              <CardTitle className="text-lg">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando eventos…
                </div>
              )}
              {!loading &&
                visibleEvents
                  .slice()
                  .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                  .slice(0, 5)
                  .map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="flex w-full items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted"
                    >
                      <div className={`h-10 w-1 rounded-full ${EVENT_TYPE_COLORS[event.type]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.startsAt).toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                          })}
                          {event.allDay ? "" : ` · ${formatEventRange(event)}`}
                        </p>
                      </div>
                    </button>
                  ))}
            </CardContent>
          </Card>
        </div>
      </main>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className={`${EVENT_TYPE_COLORS[selectedEvent.type]} rounded-t-lg text-white`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm opacity-80">{EVENT_TYPE_LABELS[selectedEvent.type]}</p>
                  <CardTitle className="text-white">{selectedEvent.title}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => setSelectedEvent(null)}
                >
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CalendarIcon className="h-5 w-5 shrink-0" />
                <span>
                  {new Date(selectedEvent.startsAt).toLocaleDateString("es-CO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5 shrink-0" />
                <span>{formatEventRange(selectedEvent)}</span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5 shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-muted-foreground">
                <Users className="h-5 w-5 shrink-0" />
                <span>
                  {selectedEvent.targetRole
                    ? (TARGET_ROLE_LABELS[selectedEvent.targetRole] ?? selectedEvent.targetRole)
                    : "Todos los roles"}
                  {" · "}
                  {selectedEvent.groupId
                    ? (groups.find((g) => g.id === selectedEvent.groupId)?.name ?? "Un grupo")
                    : "Todo el colegio"}
                </span>
              </div>
              {selectedEvent.isSchoolDayOff && (
                <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                  <CalendarOff className="h-5 w-5 shrink-0" />
                  <span>Día no lectivo</span>
                </div>
              )}
              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => openEdit(selectedEvent)}>
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setDeletingTitle(selectedEvent.title)
                    setDeleting(selectedEvent)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <CalendarSubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editing}
        defaultDay={defaultDay}
        groups={groups}
        onSaved={upsertEvent}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{deletingTitle}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece del calendario de todos los que lo veían. El registro se conserva por
              retención documental y no se borra de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
