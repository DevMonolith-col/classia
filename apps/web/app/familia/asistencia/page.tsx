"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type AttendanceStatus = "presente" | "ausente" | "tardanza" | "justificado"

interface AttendanceRecord {
  date: string
  status: AttendanceStatus
  subject?: string
  note?: string
}

const monthlyAttendance: AttendanceRecord[] = [
  { date: "2024-02-01", status: "presente" },
  { date: "2024-02-02", status: "presente" },
  { date: "2024-02-05", status: "presente" },
  { date: "2024-02-06", status: "tardanza", subject: "Matemáticas", note: "Llegó 10 minutos tarde" },
  { date: "2024-02-07", status: "presente" },
  { date: "2024-02-08", status: "presente" },
  { date: "2024-02-09", status: "ausente", subject: "Todas", note: "Enfermedad - justificante médico pendiente" },
  { date: "2024-02-12", status: "presente" },
  { date: "2024-02-13", status: "presente" },
  { date: "2024-02-14", status: "tardanza", subject: "Historia", note: "Llegó 5 minutos tarde" },
]

const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

export default function AsistenciaFamiliaPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2024, 1, 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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

  const formatDate = (day: number) => {
    return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const getAttendanceForDate = (day: number) => {
    return monthlyAttendance.find((a) => a.date === formatDate(day))
  }

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(currentMonth.getMonth() + (direction === "next" ? 1 : -1))
    setCurrentMonth(newDate)
  }

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "presente":
        return "bg-green-500"
      case "ausente":
        return "bg-red-500"
      case "tardanza":
        return "bg-yellow-500"
      case "justificado":
        return "bg-blue-500"
    }
  }

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case "presente":
        return <Check className="h-4 w-4 text-white" />
      case "ausente":
        return <X className="h-4 w-4 text-white" />
      case "tardanza":
        return <Clock className="h-4 w-4 text-white" />
      case "justificado":
        return <span className="text-xs font-bold text-white">J</span>
    }
  }

  const stats = {
    total: monthlyAttendance.length,
    presentes: monthlyAttendance.filter((a) => a.status === "presente").length,
    ausentes: monthlyAttendance.filter((a) => a.status === "ausente").length,
    tardanzas: monthlyAttendance.filter((a) => a.status === "tardanza").length,
    porcentaje: Math.round(
      (monthlyAttendance.filter((a) => a.status === "presente").length / monthlyAttendance.length) * 100
    ),
  }

  const selectedRecord = selectedDate
    ? monthlyAttendance.find((a) => a.date === selectedDate)
    : null

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Asistencia</h1>
            <p className="mt-1 text-muted-foreground">
              Historial de asistencia de María - 5to Grado A
            </p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.porcentaje}%</p>
                    <p className="text-xs text-muted-foreground">Asistencia</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.presentes}</p>
                    <p className="text-xs text-muted-foreground">Presentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <X className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.ausentes}</p>
                    <p className="text-xs text-muted-foreground">Ausencias</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.tardanzas}</p>
                    <p className="text-xs text-muted-foreground">Tardanzas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Calendario de Asistencia</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-32 text-center font-medium">
                      {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => (
                    <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {getMonthDays(currentMonth).map((day, index) => {
                    const attendance = day ? getAttendanceForDate(day) : null
                    const dateStr = day ? formatDate(day) : ""
                    const isWeekend = index % 7 === 0 || index % 7 === 6
                    const isToday = day === 12 && currentMonth.getMonth() === 1

                    return (
                      <button
                        key={index}
                        disabled={!day || isWeekend}
                        onClick={() => day && !isWeekend && setSelectedDate(dateStr)}
                        className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm transition-colors lg:h-12 ${
                          !day
                            ? ""
                            : isWeekend
                            ? "text-muted-foreground/50"
                            : selectedDate === dateStr
                            ? "ring-2 ring-primary ring-offset-2"
                            : "hover:bg-muted"
                        } ${isToday ? "font-bold text-primary" : ""}`}
                      >
                        {day && (
                          <>
                            <span className={attendance ? "sr-only" : ""}>{day}</span>
                            {attendance && (
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${getStatusColor(attendance.status)}`}>
                                {getStatusIcon(attendance.status)}
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">Presente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                      <X className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">Ausente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500">
                      <Clock className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">Tardanza</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                      <span className="text-xs font-bold text-white">J</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Justificado</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <div className="space-y-6">
              {/* Selected Date Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalles</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedRecord ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getStatusColor(selectedRecord.status)}`}>
                          {getStatusIcon(selectedRecord.status)}
                        </div>
                        <div>
                          <p className="font-medium capitalize text-foreground">{selectedRecord.status}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(selectedRecord.date).toLocaleDateString("es-ES", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </p>
                        </div>
                      </div>
                      {selectedRecord.subject && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Materia</p>
                          <p className="text-sm text-foreground">{selectedRecord.subject}</p>
                        </div>
                      )}
                      {selectedRecord.note && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Nota</p>
                          <p className="text-sm text-foreground">{selectedRecord.note}</p>
                        </div>
                      )}
                      {selectedRecord.status === "ausente" && (
                        <Button variant="outline" className="w-full">
                          Subir Justificante
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Selecciona un día para ver los detalles
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Issues */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Atención Requerida
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {monthlyAttendance
                    .filter((a) => a.status !== "presente")
                    .slice(-3)
                    .reverse()
                    .map((record, index) => (
                      <div key={index} className="flex items-center gap-3 rounded-lg bg-muted p-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getStatusColor(record.status)}`}>
                          {getStatusIcon(record.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium capitalize text-foreground">
                            {record.status}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(record.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                            {record.subject && ` - ${record.subject}`}
                          </p>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
