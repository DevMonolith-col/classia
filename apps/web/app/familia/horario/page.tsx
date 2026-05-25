"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  BookOpen,
  Calendar as CalendarIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ViewMode = "week" | "day"

interface ClassSchedule {
  id: string
  subject: string
  teacher: string
  day: number // 0-6 (Sunday-Saturday)
  startTime: string
  endTime: string
  location: string
  color: string
}

interface Event {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  type: "examen" | "evento" | "festivo" | "reunion"
  location?: string
  color: string
}

const schedule: ClassSchedule[] = [
  { id: "1", subject: "Matemáticas", teacher: "Prof. Juan López", day: 1, startTime: "08:00", endTime: "09:30", location: "Aula 101", color: "bg-blue-500" },
  { id: "2", subject: "Español", teacher: "Prof. María González", day: 1, startTime: "10:00", endTime: "11:30", location: "Aula 101", color: "bg-green-500" },
  { id: "3", subject: "Historia", teacher: "Prof. Ana Martínez", day: 1, startTime: "12:00", endTime: "13:00", location: "Aula 101", color: "bg-purple-500" },
  { id: "4", subject: "Ciencias", teacher: "Prof. Carlos Ruiz", day: 2, startTime: "08:00", endTime: "09:30", location: "Laboratorio", color: "bg-orange-500" },
  { id: "5", subject: "Matemáticas", teacher: "Prof. Juan López", day: 2, startTime: "10:00", endTime: "11:30", location: "Aula 101", color: "bg-blue-500" },
  { id: "6", subject: "Inglés", teacher: "Prof. Sarah Smith", day: 2, startTime: "12:00", endTime: "13:00", location: "Aula 205", color: "bg-pink-500" },
  { id: "7", subject: "Educación Física", teacher: "Prof. Roberto Díaz", day: 3, startTime: "08:00", endTime: "09:30", location: "Cancha", color: "bg-yellow-500" },
  { id: "8", subject: "Arte", teacher: "Prof. Laura Pérez", day: 3, startTime: "10:00", endTime: "11:30", location: "Salón de Arte", color: "bg-red-500" },
  { id: "9", subject: "Español", teacher: "Prof. María González", day: 3, startTime: "12:00", endTime: "13:00", location: "Aula 101", color: "bg-green-500" },
  { id: "10", subject: "Historia", teacher: "Prof. Ana Martínez", day: 4, startTime: "08:00", endTime: "09:30", location: "Aula 101", color: "bg-purple-500" },
  { id: "11", subject: "Ciencias", teacher: "Prof. Carlos Ruiz", day: 4, startTime: "10:00", endTime: "11:30", location: "Laboratorio", color: "bg-orange-500" },
  { id: "12", subject: "Matemáticas", teacher: "Prof. Juan López", day: 4, startTime: "12:00", endTime: "13:00", location: "Aula 101", color: "bg-blue-500" },
  { id: "13", subject: "Inglés", teacher: "Prof. Sarah Smith", day: 5, startTime: "08:00", endTime: "09:30", location: "Aula 205", color: "bg-pink-500" },
  { id: "14", subject: "Música", teacher: "Prof. Elena Vega", day: 5, startTime: "10:00", endTime: "11:30", location: "Salón de Música", color: "bg-teal-500" },
  { id: "15", subject: "Educación Física", teacher: "Prof. Roberto Díaz", day: 5, startTime: "12:00", endTime: "13:00", location: "Cancha", color: "bg-yellow-500" },
]

const events: Event[] = [
  { id: "e1", title: "Examen de Matemáticas", date: "2024-02-14", startTime: "09:00", endTime: "11:00", type: "examen", location: "Aula 101", color: "bg-red-500" },
  { id: "e2", title: "Día del Maestro", date: "2024-02-15", startTime: "00:00", endTime: "23:59", type: "festivo", color: "bg-yellow-500" },
  { id: "e3", title: "Reunión de Padres", date: "2024-02-16", startTime: "16:00", endTime: "18:00", type: "reunion", location: "Auditorio", color: "bg-purple-500" },
]

const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const weekDaysFull = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const hours = Array.from({ length: 8 }, (_, i) => i + 7) // 7 AM to 2 PM

export default function HorarioFamiliaPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 1, 12)) // Feb 12, 2024
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedClass, setSelectedClass] = useState<ClassSchedule | null>(null)

  const getWeekDays = (date: Date) => {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }

  const navigate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (viewMode === "week") {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7))
    } else {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const weekDates = getWeekDays(currentDate)

  const getClassesForDay = (dayIndex: number) => {
    return schedule.filter((c) => c.day === dayIndex)
  }

  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Horario de Clases</h1>
            <p className="mt-1 text-muted-foreground">
              Horario semanal de María - 5to Grado A
            </p>
          </div>

          {/* Calendar Controls */}
          <Card className="mb-6">
            <CardContent className="p-4">
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
                    {viewMode === "day"
                      ? `${weekDaysFull[currentDate.getDay()]}, ${currentDate.getDate()} de ${months[currentDate.getMonth()]}`
                      : `Semana del ${weekDates[0].getDate()} al ${weekDates[6].getDate()} de ${months[currentDate.getMonth()]}`}
                  </h2>
                </div>
                <div className="flex rounded-lg border border-input p-1">
                  {(["week", "day"] as ViewMode[]).map((mode) => (
                    <Button
                      key={mode}
                      variant={viewMode === mode ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode(mode)}
                    >
                      {mode === "week" ? "Semana" : "Día"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Week View */}
          {viewMode === "week" && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Mobile: Stack View */}
                <div className="lg:hidden">
                  {weekDates.slice(1, 6).map((date, index) => {
                    const dayIndex = index + 1
                    const dayClasses = getClassesForDay(dayIndex)
                    const isToday = date.getDate() === 12 && date.getMonth() === 1

                    return (
                      <div key={dayIndex} className="border-b border-border last:border-0">
                        <div className={`flex items-center gap-2 p-3 ${isToday ? "bg-primary/5" : "bg-muted/50"}`}>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                            {date.getDate()}
                          </span>
                          <span className="font-medium text-foreground">{weekDaysFull[dayIndex]}</span>
                        </div>
                        <div className="space-y-2 p-3">
                          {dayClasses.length > 0 ? (
                            dayClasses.map((cls) => (
                              <button
                                key={cls.id}
                                onClick={() => setSelectedClass(cls)}
                                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-white ${cls.color}`}
                              >
                                <div className="flex-1">
                                  <p className="font-medium">{cls.subject}</p>
                                  <p className="text-sm opacity-80">{cls.startTime} - {cls.endTime}</p>
                                </div>
                                <div className="text-right text-sm opacity-80">
                                  <p>{cls.location}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="py-4 text-center text-sm text-muted-foreground">Sin clases</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop: Grid View */}
                <div className="hidden lg:block">
                  {/* Header */}
                  <div className="grid grid-cols-6 border-b border-border">
                    <div className="p-2 text-center text-xs font-medium text-muted-foreground" />
                    {weekDates.slice(1, 6).map((date, index) => {
                      const isToday = date.getDate() === 12 && date.getMonth() === 1
                      return (
                        <div key={index} className="border-l border-border p-2 text-center">
                          <p className="text-xs text-muted-foreground">{weekDays[index + 1]}</p>
                          <p className={`text-lg font-semibold ${isToday ? "flex h-8 w-8 mx-auto items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-foreground"}`}>
                            {date.getDate()}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Time Grid */}
                  <div className="max-h-[500px] overflow-y-auto">
                    <div className="grid grid-cols-6">
                      {/* Time Column */}
                      <div>
                        {hours.map((hour) => (
                          <div key={hour} className="h-20 border-b border-border px-2 py-1">
                            <span className="text-xs text-muted-foreground">
                              {String(hour).padStart(2, "0")}:00
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Day Columns */}
                      {[1, 2, 3, 4, 5].map((dayIndex) => {
                        const dayClasses = getClassesForDay(dayIndex)

                        return (
                          <div key={dayIndex} className="relative border-l border-border">
                            {hours.map((hour) => (
                              <div key={hour} className="h-20 border-b border-border" />
                            ))}
                            {dayClasses.map((cls) => {
                              const startHour = parseInt(cls.startTime.split(":")[0])
                              const startMin = parseInt(cls.startTime.split(":")[1])
                              const endHour = parseInt(cls.endTime.split(":")[0])
                              const endMin = parseInt(cls.endTime.split(":")[1])
                              const top = (startHour - 7) * 80 + (startMin / 60) * 80
                              const height = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * 80

                              return (
                                <button
                                  key={cls.id}
                                  onClick={() => setSelectedClass(cls)}
                                  className={`absolute left-1 right-1 overflow-hidden rounded p-2 text-left text-white ${cls.color}`}
                                  style={{ top: `${top}px`, height: `${height}px` }}
                                >
                                  <p className="truncate text-sm font-medium">{cls.subject}</p>
                                  <p className="truncate text-xs opacity-80">{cls.startTime} - {cls.endTime}</p>
                                  <p className="truncate text-xs opacity-80">{cls.location}</p>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Day View */}
          {viewMode === "day" && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {getClassesForDay(currentDate.getDay()).length > 0 ? (
                    getClassesForDay(currentDate.getDay()).map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => setSelectedClass(cls)}
                        className={`flex w-full items-center gap-4 rounded-lg p-4 text-left text-white ${cls.color}`}
                      >
                        <div className="text-center">
                          <p className="text-lg font-bold">{cls.startTime}</p>
                          <p className="text-sm opacity-80">{cls.endTime}</p>
                        </div>
                        <div className="h-12 w-px bg-white/30" />
                        <div className="flex-1">
                          <p className="text-lg font-semibold">{cls.subject}</p>
                          <p className="text-sm opacity-80">{cls.teacher}</p>
                          <p className="text-sm opacity-80">{cls.location}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-12 text-center">
                      <CalendarIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="text-lg font-medium text-foreground">Sin clases</p>
                      <p className="text-sm text-muted-foreground">No hay clases programadas para este día</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-lg border border-input p-3">
                  <div className={`h-10 w-1 rounded-full ${event.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
                      {event.type !== "festivo" && ` - ${event.startTime}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    event.type === "examen" ? "bg-red-100 text-red-800" :
                    event.type === "festivo" ? "bg-yellow-100 text-yellow-800" :
                    "bg-purple-100 text-purple-800"
                  }`}>
                    {event.type}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Class Detail Modal */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className={`${selectedClass.color} text-white rounded-t-lg`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm opacity-80">Clase</p>
                  <CardTitle className="text-white">{selectedClass.subject}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setSelectedClass(null)}>
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <BookOpen className="h-5 w-5" />
                <span>{selectedClass.teacher}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <CalendarIcon className="h-5 w-5" />
                <span>{weekDaysFull[selectedClass.day]}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>{selectedClass.startTime} - {selectedClass.endTime}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="h-5 w-5" />
                <span>{selectedClass.location}</span>
              </div>
              <Button variant="outline" className="w-full mt-4">
                Contactar Profesor
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
