"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  Calendar as CalendarIcon,
  Building,
  GraduationCap,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ViewMode = "month" | "week"

interface Event {
  id: string
  title: string
  description?: string
  date: string
  startTime: string
  endTime: string
  type: "academico" | "reunion" | "evento" | "festivo" | "administrativo"
  location?: string
  attendees?: number
  color: string
}

const mockEvents: Event[] = [
  { id: "1", title: "Inicio de Inscripciones", date: "2024-02-12", startTime: "08:00", endTime: "17:00", type: "administrativo", color: "bg-blue-500" },
  { id: "2", title: "Reunión Consejo Directivo", date: "2024-02-12", startTime: "10:00", endTime: "12:00", type: "reunion", location: "Sala de Juntas", attendees: 8, color: "bg-purple-500" },
  { id: "3", title: "Capacitación Docentes", date: "2024-02-13", startTime: "14:00", endTime: "17:00", type: "academico", location: "Auditorio", attendees: 45, color: "bg-green-500" },
  { id: "4", title: "Exámenes Parciales", date: "2024-02-14", startTime: "08:00", endTime: "14:00", type: "academico", color: "bg-orange-500" },
  { id: "5", title: "Día del Maestro", date: "2024-02-15", startTime: "00:00", endTime: "23:59", type: "festivo", color: "bg-yellow-500" },
  { id: "6", title: "Entrega de Boletas", date: "2024-02-16", startTime: "08:00", endTime: "14:00", type: "administrativo", location: "Aulas", color: "bg-blue-500" },
  { id: "7", title: "Festival Cultural", date: "2024-02-17", startTime: "10:00", endTime: "14:00", type: "evento", location: "Patio Central", attendees: 500, color: "bg-pink-500" },
  { id: "8", title: "Junta de Padres - Primaria", date: "2024-02-19", startTime: "16:00", endTime: "18:00", type: "reunion", location: "Auditorio", attendees: 200, color: "bg-purple-500" },
  { id: "9", title: "Simulacro de Evacuación", date: "2024-02-20", startTime: "11:00", endTime: "12:00", type: "administrativo", color: "bg-red-500" },
  { id: "10", title: "Cierre de Calificaciones", date: "2024-02-22", startTime: "00:00", endTime: "23:59", type: "academico", color: "bg-orange-500" },
]

const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

export default function CalendarioAdminPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 1, 12))
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedType, setSelectedType] = useState<string>("Todos")

  const types = ["Todos", "academico", "reunion", "evento", "festivo", "administrativo"]

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (number | null)[] = []
    for (let i = 0; i < startingDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  const getWeekDays = (date: Date) => {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  const getEventsForDate = (date: string) => {
    return mockEvents.filter((e) => {
      const matchesDate = e.date === date
      const matchesType = selectedType === "Todos" || e.type === selectedType
      return matchesDate && matchesType
    })
  }

  const filteredEvents = mockEvents.filter((e) => selectedType === "Todos" || e.type === selectedType)

  const navigate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (viewMode === "month") {
      newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1))
    } else {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7))
    }
    setCurrentDate(newDate)
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      academico: "Académico",
      reunion: "Reunión",
      evento: "Evento",
      festivo: "Festivo",
      administrativo: "Administrativo",
    }
    return labels[type] || type
  }

  const stats = {
    total: filteredEvents.length,
    esteMes: filteredEvents.filter((e) => new Date(e.date).getMonth() === currentDate.getMonth()).length,
    reuniones: mockEvents.filter((e) => e.type === "reunion").length,
    eventos: mockEvents.filter((e) => e.type === "evento").length,
  }

  const weekDates = getWeekDays(currentDate)

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Calendario Escolar</h1>
              <p className="mt-1 text-muted-foreground">
                Gestiona los eventos y actividades del ciclo escolar
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Evento
            </Button>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Eventos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.esteMes}</p>
                    <p className="text-xs text-muted-foreground">Este Mes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.reuniones}</p>
                    <p className="text-xs text-muted-foreground">Reuniones</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100">
                    <GraduationCap className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.eventos}</p>
                    <p className="text-xs text-muted-foreground">Eventos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calendar Controls */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date(2024, 1, 12))}>
                      Hoy
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => navigate("prev")}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => navigate("next")}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold text-foreground">
                      {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                  </div>
                  <div className="flex rounded-lg border border-input p-1">
                    {(["month", "week"] as ViewMode[]).map((mode) => (
                      <Button
                        key={mode}
                        variant={viewMode === mode ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode(mode)}
                      >
                        {mode === "month" ? "Mes" : "Semana"}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {types.map((type) => (
                    <Button
                      key={type}
                      variant={selectedType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedType(type)}
                    >
                      {type === "Todos" ? type : getTypeLabel(type)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month View */}
          {viewMode === "month" && (
            <Card>
              <CardContent className="p-2 lg:p-4">
                <div className="grid grid-cols-7 gap-px bg-border">
                  {weekDays.map((day) => (
                    <div key={day} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground lg:text-sm">
                      <span className="hidden lg:inline">{day}</span>
                      <span className="lg:hidden">{day.charAt(0)}</span>
                    </div>
                  ))}
                  {getMonthDays(currentDate).map((day, index) => {
                    const dateStr = day
                      ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      : ""
                    const events = day ? getEventsForDate(dateStr) : []
                    const isToday = day === 12 && currentDate.getMonth() === 1

                    return (
                      <div
                        key={index}
                        className={`min-h-20 bg-background p-1 lg:min-h-28 ${!day ? "bg-muted/50" : ""}`}
                      >
                        {day && (
                          <>
                            <p className={`mb-1 text-xs lg:text-sm ${isToday ? "flex h-5 w-5 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-foreground"}`}>
                              {day}
                            </p>
                            <div className="space-y-0.5 lg:space-y-1">
                              {events.slice(0, 2).map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => setSelectedEvent(event)}
                                  className={`hidden w-full truncate rounded px-1 py-0.5 text-left text-xs text-white lg:block ${event.color}`}
                                >
                                  {event.title}
                                </button>
                              ))}
                              {events.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 lg:hidden">
                                  {events.slice(0, 3).map((event) => (
                                    <button
                                      key={event.id}
                                      onClick={() => setSelectedEvent(event)}
                                      className={`h-1.5 w-1.5 rounded-full ${event.color}`}
                                    />
                                  ))}
                                </div>
                              )}
                              {events.length > 2 && (
                                <p className="hidden text-xs text-muted-foreground lg:block">+{events.length - 2} más</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {weekDates.map((date, index) => {
                    const dateStr = formatDate(date)
                    const events = getEventsForDate(dateStr)
                    const isToday = date.getDate() === 12 && date.getMonth() === 1

                    return (
                      <div key={index} className="flex gap-4">
                        <div className={`flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <span className="text-xs">{weekDays[index]}</span>
                          <span className="text-lg font-bold">{date.getDate()}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          {events.length > 0 ? (
                            events.map((event) => (
                              <button
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-white ${event.color}`}
                              >
                                <div className="flex-1">
                                  <p className="font-medium">{event.title}</p>
                                  <p className="text-sm opacity-80">
                                    {event.type !== "festivo" && `${event.startTime} - ${event.endTime}`}
                                    {event.location && ` | ${event.location}`}
                                  </p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="flex h-14 items-center rounded-lg border border-dashed border-input px-3">
                              <p className="text-sm text-muted-foreground">Sin eventos</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events */}
          <Card className="mt-6 lg:hidden">
            <CardHeader>
              <CardTitle className="text-lg">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredEvents.slice(0, 5).map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="flex w-full items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className={`h-10 w-1 rounded-full ${event.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      {event.type !== "festivo" && ` - ${event.startTime}`}
                    </p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className={`${selectedEvent.color} text-white rounded-t-lg`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm opacity-80">{getTypeLabel(selectedEvent.type)}</p>
                  <CardTitle className="text-white">{selectedEvent.title}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setSelectedEvent(null)}>
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CalendarIcon className="h-5 w-5" />
                <span>
                  {new Date(selectedEvent.date).toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              {selectedEvent.type !== "festivo" && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                  <span>{selectedEvent.startTime} - {selectedEvent.endTime}</span>
                </div>
              )}
              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.attendees && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Users className="h-5 w-5" />
                  <span>{selectedEvent.attendees} asistentes esperados</span>
                </div>
              )}
              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              )}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1">Editar</Button>
                <Button variant="destructive" className="flex-1">Eliminar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
