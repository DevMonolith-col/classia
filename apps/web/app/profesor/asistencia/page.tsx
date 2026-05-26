"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Users,
  Calendar,
  Search,
  Download,
  Filter,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Upload,
  Paperclip,
  Heart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type AttendanceStatus = "presente" | "ausente" | "tardanza" | "justificado" | "incapacitado" | null

type IncapacidadStatus = "pendiente" | "aprobada" | "rechazada"

interface Student {
  id: string
  name: string
  avatar: string
  attendance: Record<string, AttendanceStatus>
}

interface Incapacidad {
  id: string
  studentId: string
  studentName: string
  studentAvatar: string
  startDate: string
  endDate: string
  reason: string
  document: string
  documentType: string
  submittedBy: string
  submittedByRole: "padre" | "estudiante"
  submittedAt: string
  status: IncapacidadStatus
  notes: string
}

const mockStudents: Student[] = [
  { id: "1", name: "Ana García López", avatar: "AG", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "tardanza", "2024-02-15": null, "2024-02-16": null } },
  { id: "2", name: "Carlos Martínez Ruiz", avatar: "CM", attendance: { "2024-02-12": "presente", "2024-02-13": "ausente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
  { id: "3", name: "Diana Pérez Sánchez", avatar: "DP", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
  { id: "4", name: "Eduardo Rodríguez", avatar: "ER", attendance: { "2024-02-12": "tardanza", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
  { id: "5", name: "Fernanda López Vega", avatar: "FL", attendance: { "2024-02-12": "incapacitado", "2024-02-13": "incapacitado", "2024-02-14": "incapacitado", "2024-02-15": null, "2024-02-16": null } },
  { id: "6", name: "Gabriel Hernández", avatar: "GH", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "ausente", "2024-02-15": null, "2024-02-16": null } },
  { id: "7", name: "Helena Torres Mora", avatar: "HT", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
  { id: "8", name: "Iván Ramírez Castro", avatar: "IR", attendance: { "2024-02-12": "ausente", "2024-02-13": "justificado", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
]

const mockIncapacidades: Incapacidad[] = [
  {
    id: "1",
    studentId: "5",
    studentName: "Fernanda López Vega",
    studentAvatar: "FL",
    startDate: "2024-02-12",
    endDate: "2024-02-16",
    reason: "Cirugía de apéndice - Reposo médico obligatorio",
    document: "incapacidad_fernanda.pdf",
    documentType: "PDF",
    submittedBy: "María Vega (Madre)",
    submittedByRole: "padre",
    submittedAt: "2024-02-11 08:30",
    status: "aprobada",
    notes: "Aprobada - Documento médico válido del Hospital Central",
  },
  {
    id: "2",
    studentId: "2",
    studentName: "Carlos Martínez Ruiz",
    studentAvatar: "CM",
    startDate: "2024-02-19",
    endDate: "2024-02-21",
    reason: "Fractura de muñeca - Accidente deportivo",
    document: "certificado_carlos.jpg",
    documentType: "Imagen",
    submittedBy: "Roberto Martínez (Padre)",
    submittedByRole: "padre",
    submittedAt: "2024-02-18 14:22",
    status: "pendiente",
    notes: "",
  },
  {
    id: "3",
    studentId: "7",
    studentName: "Helena Torres Mora",
    studentAvatar: "HT",
    startDate: "2024-02-15",
    endDate: "2024-02-15",
    reason: "Cita médica programada",
    document: "cita_helena.pdf",
    documentType: "PDF",
    submittedBy: "Helena Torres",
    submittedByRole: "estudiante",
    submittedAt: "2024-02-14 16:45",
    status: "pendiente",
    notes: "",
  },
  {
    id: "4",
    studentId: "6",
    studentName: "Gabriel Hernández",
    studentAvatar: "GH",
    startDate: "2024-02-14",
    endDate: "2024-02-14",
    reason: "Malestar estomacal",
    document: "",
    documentType: "",
    submittedBy: "Gabriel Hernández",
    submittedByRole: "estudiante",
    submittedAt: "2024-02-14 07:15",
    status: "rechazada",
    notes: "Rechazada - No se adjuntó documento médico válido",
  },
]

const courses = [
  { id: "1", name: "Matemáticas 5to A", students: 32 },
  { id: "2", name: "Matemáticas 6to B", students: 28 },
  { id: "3", name: "Matemáticas 4to A", students: 30 },
]

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie"]
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

type ViewType = "asistencia" | "incapacidades"

export default function AsistenciaProfesorPage() {
  const [activeView, setActiveView] = useState<ViewType>("asistencia")
  const [selectedCourse, setSelectedCourse] = useState(courses[0])
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date(2024, 1, 12))
  const [students, setStudents] = useState(mockStudents)
  const [incapacidades, setIncapacidades] = useState(mockIncapacidades)
  const [searchQuery, setSearchQuery] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [incapacidadFilter, setIncapacidadFilter] = useState<"todas" | IncapacidadStatus>("todas")
  const [selectedIncapacidad, setSelectedIncapacidad] = useState<Incapacidad | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")

  const getWeekDates = () => {
    const dates: Date[] = []
    const start = new Date(currentWeekStart)
    for (let i = 0; i < 5; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  const weekDates = getWeekDates()

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(currentWeekStart.getDate() + (direction === "next" ? 7 : -7))
    setCurrentWeekStart(newDate)
  }

  const updateAttendance = (studentId: string, date: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, attendance: { ...s.attendance, [date]: status } }
          : s
      )
    )
  }

  const markAllPresent = (date: string) => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        attendance: { ...s.attendance, [date]: "presente" },
      }))
    )
  }

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "presente":
        return "bg-green-500 text-white"
      case "ausente":
        return "bg-red-500 text-white"
      case "tardanza":
        return "bg-yellow-500 text-white"
      case "justificado":
        return "bg-blue-500 text-white"
      case "incapacitado":
        return "bg-purple-500 text-white"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case "presente":
        return <Check className="h-4 w-4" />
      case "ausente":
        return <X className="h-4 w-4" />
      case "tardanza":
        return <Clock className="h-4 w-4" />
      case "justificado":
        return <span className="text-xs font-bold">J</span>
      case "incapacitado":
        return <Heart className="h-4 w-4" />
      default:
        return <span className="text-xs">-</span>
    }
  }

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredIncapacidades = incapacidades.filter((inc) => {
    const matchesSearch = inc.studentName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = incapacidadFilter === "todas" || inc.status === incapacidadFilter
    return matchesSearch && matchesFilter
  })

  const pendingIncapacidades = incapacidades.filter((i) => i.status === "pendiente").length

  const stats = {
    presentes: students.filter((s) => s.attendance[formatDate(weekDates[0])] === "presente").length,
    ausentes: students.filter((s) => s.attendance[formatDate(weekDates[0])] === "ausente").length,
    tardanzas: students.filter((s) => s.attendance[formatDate(weekDates[0])] === "tardanza").length,
    incapacitados: students.filter((s) => s.attendance[formatDate(weekDates[0])] === "incapacitado").length,
    porcentaje: Math.round(
      (students.filter((s) => s.attendance[formatDate(weekDates[0])] === "presente").length / students.length) * 100
    ) || 0,
  }

  const handleApproveIncapacidad = (id: string) => {
    setIncapacidades((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? { ...inc, status: "aprobada" as IncapacidadStatus, notes: reviewNotes || "Aprobada por el profesor" }
          : inc
      )
    )
    setSelectedIncapacidad(null)
    setReviewNotes("")
  }

  const handleRejectIncapacidad = (id: string) => {
    setIncapacidades((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? { ...inc, status: "rechazada" as IncapacidadStatus, notes: reviewNotes || "Rechazada - Documento no válido" }
          : inc
      )
    )
    setSelectedIncapacidad(null)
    setReviewNotes("")
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Control de Asistencia</h1>
              <p className="mt-1 text-muted-foreground">
                Registra la asistencia y gestiona incapacidades de tus estudiantes
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
              {activeView === "asistencia" && (
                <Button onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? "Guardar Cambios" : "Editar Asistencia"}
                </Button>
              )}
            </div>
          </div>

          {/* View Toggle */}
          <div className="mb-6 flex rounded-lg border border-border bg-muted p-1">
            <button
              onClick={() => setActiveView("asistencia")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeView === "asistencia"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Asistencia Diaria
            </button>
            <button
              onClick={() => setActiveView("incapacidades")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeView === "incapacidades"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-4 w-4" />
              Incapacidades
              {pendingIncapacidades > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {pendingIncapacidades}
                </span>
              )}
            </button>
          </div>

          {activeView === "asistencia" ? (
            <>
              {/* Course Selector & Stats */}
              <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Seleccionar Curso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {courses.map((course) => (
                        <Button
                          key={course.id}
                          variant={selectedCourse.id === course.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCourse(course)}
                        >
                          {course.name}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-5 gap-2">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.presentes}</p>
                      <p className="text-xs text-muted-foreground">Presentes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{stats.ausentes}</p>
                      <p className="text-xs text-muted-foreground">Ausentes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{stats.tardanzas}</p>
                      <p className="text-xs text-muted-foreground">Tardanzas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-purple-600">{stats.incapacitados}</p>
                      <p className="text-xs text-muted-foreground">Incapacitados</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{stats.porcentaje}%</p>
                      <p className="text-xs text-muted-foreground">Asistencia</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Week Navigation */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => navigateWeek("prev")}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigateWeek("next")}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="font-medium text-foreground">
                        {weekDates[0].getDate()} - {weekDates[4].getDate()} de {months[currentWeekStart.getMonth()]} {currentWeekStart.getFullYear()}
                      </span>
                    </div>
                    <div className="relative hidden lg:block">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar estudiante..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mobile Search */}
              <div className="mb-4 lg:hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar estudiante..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Attendance Table - Desktop */}
              <Card className="hidden lg:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted">
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estudiante</th>
                          {weekDates.map((date, index) => {
                            const dateStr = formatDate(date)
                            const isToday = date.getDate() === 12 && date.getMonth() === 1
                            return (
                              <th key={index} className={`px-4 py-3 text-center ${isToday ? "bg-primary/10" : ""}`}>
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-muted-foreground">{weekDays[index]}</span>
                                  <span className={`text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                                    {date.getDate()}
                                  </span>
                                </div>
                                {isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1 h-6 text-xs"
                                    onClick={() => markAllPresent(dateStr)}
                                  >
                                    Marcar todos
                                  </Button>
                                )}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="border-b border-border hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                  {student.avatar}
                                </div>
                                <span className="font-medium text-foreground">{student.name}</span>
                              </div>
                            </td>
                            {weekDates.map((date, index) => {
                              const dateStr = formatDate(date)
                              const status = student.attendance[dateStr]
                              const isToday = date.getDate() === 12 && date.getMonth() === 1

                              return (
                                <td key={index} className={`px-4 py-3 text-center ${isToday ? "bg-primary/5" : ""}`}>
                                  {isEditing ? (
                                    <div className="flex justify-center gap-1">
                                      {(["presente", "ausente", "tardanza", "justificado", "incapacitado"] as NonNullable<AttendanceStatus>[]).map((s) => (
                                        <button
                                          key={s}
                                          onClick={() => updateAttendance(student.id, dateStr, s)}
                                          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                                            status === s ? getStatusColor(s) : "bg-muted hover:bg-muted-foreground/20"
                                          }`}
                                          title={s.charAt(0).toUpperCase() + s.slice(1)}
                                        >
                                          {getStatusIcon(s)}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${getStatusColor(status)}`}>
                                      {getStatusIcon(status)}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Cards - Mobile */}
              <div className="space-y-4 lg:hidden">
                {filteredStudents.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {student.avatar}
                        </div>
                        <span className="font-medium text-foreground">{student.name}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {weekDates.map((date, index) => {
                          const dateStr = formatDate(date)
                          const status = student.attendance[dateStr]
                          const isToday = date.getDate() === 12 && date.getMonth() === 1

                          return (
                            <div key={index} className="text-center">
                              <p className="mb-1 text-xs text-muted-foreground">{weekDays[index]}</p>
                              <p className={`mb-2 text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                                {date.getDate()}
                              </p>
                              {isEditing ? (
                                <select
                                  value={status || ""}
                                  onChange={(e) => updateAttendance(student.id, dateStr, (e.target.value || null) as AttendanceStatus)}
                                  className="w-full rounded border border-input bg-background p-1 text-xs"
                                >
                                  <option value="">-</option>
                                  <option value="presente">P</option>
                                  <option value="ausente">A</option>
                                  <option value="tardanza">T</option>
                                  <option value="justificado">J</option>
                                  <option value="incapacitado">I</option>
                                </select>
                              ) : (
                                <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${getStatusColor(status)}`}>
                                  {getStatusIcon(status)}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Legend */}
              <Card className="mt-6">
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-medium text-foreground">Leyenda</p>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-muted-foreground">Presente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                        <X className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-muted-foreground">Ausente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-white">
                        <Clock className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-muted-foreground">Tardanza</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                        <span className="text-xs font-bold">J</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Justificado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white">
                        <Heart className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-muted-foreground">Incapacitado</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* Incapacidades View */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por estudiante..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex rounded-lg border border-input bg-background p-1">
                  {(["todas", "pendiente", "aprobada", "rechazada"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setIncapacidadFilter(filter)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        incapacidadFilter === filter
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {filter === "todas" ? "Todas" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      {filter === "pendiente" && pendingIncapacidades > 0 && (
                        <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                          {pendingIncapacidades}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Incapacidades Stats */}
              <div className="mb-6 grid gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                        <FileText className="h-6 w-6 text-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{incapacidades.length}</p>
                        <p className="text-sm text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                        <AlertCircle className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{incapacidades.filter((i) => i.status === "pendiente").length}</p>
                        <p className="text-sm text-muted-foreground">Pendientes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{incapacidades.filter((i) => i.status === "aprobada").length}</p>
                        <p className="text-sm text-muted-foreground">Aprobadas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                        <XCircle className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{incapacidades.filter((i) => i.status === "rechazada").length}</p>
                        <p className="text-sm text-muted-foreground">Rechazadas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Incapacidades List */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* List */}
                <div className="space-y-4">
                  {filteredIncapacidades.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-lg font-medium text-foreground">No hay incapacidades</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          No se encontraron incapacidades con los filtros actuales
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredIncapacidades.map((inc) => (
                      <Card
                        key={inc.id}
                        className={`cursor-pointer transition-all ${
                          selectedIncapacidad?.id === inc.id ? "ring-2 ring-primary" : "hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedIncapacidad(inc)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                                {inc.studentAvatar}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{inc.studentName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {inc.startDate === inc.endDate
                                    ? inc.startDate
                                    : `${inc.startDate} - ${inc.endDate}`}
                                </p>
                              </div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                              inc.status === "pendiente" ? "bg-amber-100 text-amber-700" :
                              inc.status === "aprobada" ? "bg-green-100 text-green-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{inc.reason}</p>
                          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {inc.submittedBy}
                            </span>
                            {inc.document && (
                              <span className="flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {inc.documentType}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Detail Panel */}
                <div className="lg:sticky lg:top-6">
                  {selectedIncapacidad ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Detalle de Incapacidad</CardTitle>
                          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                            selectedIncapacidad.status === "pendiente" ? "bg-amber-100 text-amber-700" :
                            selectedIncapacidad.status === "aprobada" ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {selectedIncapacidad.status.charAt(0).toUpperCase() + selectedIncapacidad.status.slice(1)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                            {selectedIncapacidad.studentAvatar}
                          </div>
                          <div>
                            <p className="text-lg font-medium text-foreground">{selectedIncapacidad.studentName}</p>
                            <p className="text-sm text-muted-foreground">
                              Enviado por {selectedIncapacidad.submittedBy}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 rounded-lg bg-muted p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Fecha de inicio</span>
                            <span className="font-medium text-foreground">{selectedIncapacidad.startDate}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Fecha de fin</span>
                            <span className="font-medium text-foreground">{selectedIncapacidad.endDate}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Enviado el</span>
                            <span className="font-medium text-foreground">{selectedIncapacidad.submittedAt}</span>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm text-muted-foreground">Motivo</Label>
                          <p className="mt-1 text-foreground">{selectedIncapacidad.reason}</p>
                        </div>

                        {selectedIncapacidad.document && (
                          <div>
                            <Label className="text-sm text-muted-foreground">Documento Adjunto</Label>
                            <div className="mt-2 flex items-center justify-between rounded-lg border border-border p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                                  <FileText className="h-5 w-5 text-foreground" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{selectedIncapacidad.document}</p>
                                  <p className="text-xs text-muted-foreground">{selectedIncapacidad.documentType}</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="gap-1">
                                <Eye className="h-4 w-4" />
                                Ver
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedIncapacidad.notes && (
                          <div>
                            <Label className="text-sm text-muted-foreground">Notas de Revisión</Label>
                            <p className="mt-1 rounded-lg bg-muted p-3 text-sm text-foreground">{selectedIncapacidad.notes}</p>
                          </div>
                        )}

                        {selectedIncapacidad.status === "pendiente" && (
                          <>
                            <div>
                              <Label htmlFor="reviewNotes">Notas de Revisión (opcional)</Label>
                              <Textarea
                                id="reviewNotes"
                                placeholder="Agregar notas sobre la decisión..."
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                className="mt-2"
                                rows={3}
                              />
                            </div>

                            <div className="flex gap-3">
                              <Button
                                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                                onClick={() => handleApproveIncapacidad(selectedIncapacidad.id)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Aprobar
                              </Button>
                              <Button
                                variant="destructive"
                                className="flex-1 gap-2"
                                onClick={() => handleRejectIncapacidad(selectedIncapacidad.id)}
                              >
                                <XCircle className="h-4 w-4" />
                                Rechazar
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-lg font-medium text-foreground">Selecciona una incapacidad</p>
                        <p className="mt-1 text-center text-sm text-muted-foreground">
                          Haz clic en una incapacidad de la lista para ver sus detalles y revisarla
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
