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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ViewMode = "month" | "week" | "day"

interface Event {
  id: string
  title: string
  description?: string
  date: string
  startTime: string
  endTime: string
  type: "clase" | "reunion" | "evento" | "examen" | "festivo"
  location?: string
  course?: string
  color: string
}

const mockEvents: Event[] = [
  { id: "1", title: "Matemáticas 5to A", date: "2024-02-12", startTime: "08:00", endTime: "09:30", type: "clase", course: "5to A", location: "Aula 101", color: "bg-blue-500" },
  { id: "2", title: "Matemáticas 6to B", date: "2024-02-12", startTime: "10:00", endTime: "11:30", type: "clase", course: "6to B", location: "Aula 203", color: "bg-green-500" },
  { id: "3", title: "Reunión de Profesores", date: "2024-02-12", startTime: "14:00", endTime: "15:00", type: "reunion", location: "Sala de Juntas", color: "bg-purple-500" },
  { id: "4", title: "Matemáticas 4to A", date: "2024-02-13", startTime: "08:00", endTime: "09:30", type: "clase", course: "4to A", location: "Aula 102", color: "bg-orange-500" },
  { id: "5", title: "Matemáticas 5to A", date: "2024-02-13", startTime: "10:00", endTime: "11:30", type: "clase", course: "5to A", location: "Aula 101", color: "bg-blue-500" },
  { id: "6", title: "Examen Parcial - Álgebra", date: "2024-02-14", startTime: "09:00", endTime: "11:00", type: "examen", course: "5to A", location: "Aula 101", color: "bg-red-500" },
  { id: "7", title: "Matemáticas 6to B", date: "2024-02-14", startTime: "14:00", endTime: "15:30", type: "clase", course: "6to B", location: "Aula 203", color: "bg-green-500" },
  { id: "8", title: "Día del Maestro", date: "2024-02-15", startTime: "00:00", endTime: "23:59", type: "festivo", color: "bg-yellow-500" },
  { id: "9", title: "Matemáticas 5to A", date: "2024-02-16", startTime: "08:00", endTime: "09:30", type: "clase", course: "5to A", location: "Aula 101", color: "bg-blue-500" },
  { id: "10", title: "Entrega Proyecto Final", date: "2024-02-16", startTime: "16:00", endTime: "17:00", type: "evento", course: "6to B", location: "Auditorio", color: "bg-pink-500" },
]

const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const weekDaysFull = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7 AM to 8 PM

export default function HorarioProfesorPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 1, 12)) // Feb 12, 2024
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

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
    return mockEvents.filter((e) => e.date === date)
  }

  const navigate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (viewMode === "month") {
      newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1))
    } else if (viewMode === "week") {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7))
    } else {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date(2024, 1, 12))
  }

  const weekDates = getWeekDays(currentDate)

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Mi Horario</h1>
              <p className="mt-1 text-muted-foreground">
                Gestiona tu calendario de clases y eventos
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Evento
            </Button>
          </div>

          {/* Calendar Controls */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Hoy
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate("prev")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate("next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold text-foreground">
                    {viewMode === "day"
                      ? `${currentDate.getDate()} de ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                      : `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                  </h2>
                </div>
                <div className="flex rounded-lg border border-input p-1">
                  {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                    <Button
                      key={mode}
                      variant={viewMode === mode ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode(mode)}
                      className="capitalize"
                    >
                      {mode === "month" ? "Mes" : mode === "week" ? "Semana" : "Día"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month View */}
          {viewMode === "month" && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 gap-px bg-border">
                  {weekDays.map((day) => (
                    <div key={day} className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground">
                      {day}
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
                        className={`min-h-24 bg-background p-1 ${!day ? "bg-muted/50" : ""}`}
                      >
                        {day && (
                          <>
                            <p className={`mb-1 text-sm ${isToday ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-foreground"}`}>
                              {day}
                            </p>
                            <div className="space-y-1">
                              {events.slice(0, 2).map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => setSelectedEvent(event)}
                                  className={`w-full truncate rounded px-1 py-0.5 text-left text-xs text-white ${event.color}`}
                                >
                                  {event.title}
                                </button>
                              ))}
                              {events.length > 2 && (
                                <p className="text-xs text-muted-foreground">+{events.length - 2} más</p>
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
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header */}
                <div className="grid grid-cols-8 border-b border-border">
                  <div className="p-2 text-center text-xs font-medium text-muted-foreground" />
                  {weekDates.map((date, index) => {
                    const isToday = date.getDate() === 12 && date.getMonth() === 1
                    return (
                      <div key={index} className="border-l border-border p-2 text-center">
                        <p className="text-xs text-muted-foreground">{weekDays[index]}</p>
                        <p className={`text-lg font-semibold ${isToday ? "flex h-8 w-8 mx-auto items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-foreground"}`}>
                          {date.getDate()}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Time Grid */}
                <div className="max-h-[600px] overflow-y-auto">
                  <div className="grid grid-cols-8">
                    {/* Time Column */}
                    <div>
                      {hours.map((hour) => (
                        <div key={hour} className="h-16 border-b border-border px-2 py-1">
                          <span className="text-xs text-muted-foreground">
                            {String(hour).padStart(2, "0")}:00
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Day Columns */}
                    {weekDates.map((date, dayIndex) => {
                      const dateStr = formatDate(date)
                      const dayEvents = getEventsForDate(dateStr)

                      return (
                        <div key={dayIndex} className="relative border-l border-border">
                          {hours.map((hour) => (
                            <div key={hour} className="h-16 border-b border-border" />
                          ))}
                          {dayEvents.map((event) => {
                            const startHour = parseInt(event.startTime.split(":")[0])
                            const startMin = parseInt(event.startTime.split(":")[1])
                            const endHour = parseInt(event.endTime.split(":")[0])
                            const endMin = parseInt(event.endTime.split(":")[1])
                            const top = (startHour - 7) * 64 + (startMin / 60) * 64
                            const height = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * 64

                            if (event.type === "festivo") return null

                            return (
                              <button
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className={`absolute left-1 right-1 overflow-hidden rounded p-1 text-left text-white ${event.color}`}
                                style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
                              >
                                <p className="truncate text-xs font-medium">{event.title}</p>
                                {height > 40 && (
                                  <p className="truncate text-xs opacity-80">{event.startTime} - {event.endTime}</p>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Day View */}
          {viewMode === "day" && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-4 text-center">
                  <h3 className="text-lg font-semibold text-foreground">
                    {weekDaysFull[currentDate.getDay()]}, {currentDate.getDate()} de {months[currentDate.getMonth()]}
                  </h3>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {hours.map((hour) => {
                    const events = getEventsForDate(formatDate(currentDate)).filter((e) => {
                      const eventHour = parseInt(e.startTime.split(":")[0])
                      return eventHour === hour
                    })

                    return (
                      <div key={hour} className="flex border-b border-border">
                        <div className="w-16 flex-shrink-0 py-4 pr-2 text-right text-sm text-muted-foreground">
                          {String(hour).padStart(2, "0")}:00
                        </div>
                        <div className="flex-1 min-h-16 py-1">
                          {events.map((event) => (
                            <button
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`mb-1 w-full rounded p-2 text-left text-white ${event.color}`}
                            >
                              <p className="font-medium">{event.title}</p>
                              <p className="text-sm opacity-80">{event.startTime} - {event.endTime}</p>
                              {event.location && <p className="text-sm opacity-80">{event.location}</p>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events Sidebar (Mobile) */}
          <Card className="mt-6 lg:hidden">
            <CardHeader>
              <CardTitle className="text-lg">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockEvents.slice(0, 5).map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="flex w-full items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className={`h-10 w-1 rounded-full ${event.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} - {event.startTime}
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
                  <p className="text-sm opacity-80 capitalize">{selectedEvent.type}</p>
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
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>{selectedEvent.startTime} - {selectedEvent.endTime}</span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.course && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Users className="h-5 w-5" />
                  <span>{selectedEvent.course}</span>
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
