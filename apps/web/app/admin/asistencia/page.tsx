"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Search,
  Download,
  Filter,
  Users,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type AttendanceStatus = "presente" | "ausente" | "tardanza" | "justificado" | null

interface Student {
  id: string
  name: string
  avatar: string
  attendance: Record<string, AttendanceStatus>
}

interface Course {
  id: string
  name: string
  grade: string
  teacher: string
  students: Student[]
  schedule: string
}

const mockCourses: Course[] = [
  {
    id: "1",
    name: "Matemáticas",
    grade: "5to A",
    teacher: "Prof. Juan López",
    schedule: "Lun, Mié, Vie - 8:00",
    students: [
      { id: "1", name: "Ana García López", avatar: "AG", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "tardanza", "2024-02-15": null, "2024-02-16": null } },
      { id: "2", name: "Carlos Martínez Ruiz", avatar: "CM", attendance: { "2024-02-12": "presente", "2024-02-13": "ausente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
      { id: "3", name: "Diana Pérez Sánchez", avatar: "DP", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
      { id: "4", name: "Eduardo Rodríguez", avatar: "ER", attendance: { "2024-02-12": "tardanza", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
      { id: "5", name: "Fernanda López Vega", avatar: "FL", attendance: { "2024-02-12": "presente", "2024-02-13": "justificado", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
    ],
  },
  {
    id: "2",
    name: "Lenguaje",
    grade: "5to A",
    teacher: "Prof. María Sánchez",
    schedule: "Mar, Jue - 9:00",
    students: [
      { id: "1", name: "Ana García López", avatar: "AG", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
      { id: "2", name: "Carlos Martínez Ruiz", avatar: "CM", attendance: { "2024-02-12": "ausente", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
      { id: "3", name: "Diana Pérez Sánchez", avatar: "DP", attendance: { "2024-02-12": "presente", "2024-02-13": "tardanza", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
    ],
  },
  {
    id: "3",
    name: "Ciencias",
    grade: "6to B",
    teacher: "Prof. Roberto Díaz",
    schedule: "Lun, Mié - 10:00",
    students: [
      { id: "6", name: "Gabriel Hernández", avatar: "GH", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "ausente", "2024-02-15": null, "2024-02-16": null } },
      { id: "7", name: "Helena Torres Mora", avatar: "HT", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
      { id: "8", name: "Iván Ramírez Castro", avatar: "IR", attendance: { "2024-02-12": "ausente", "2024-02-13": "justificado", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
    ],
  },
  {
    id: "4",
    name: "Historia",
    grade: "4to A",
    teacher: "Prof. Carmen Ruiz",
    schedule: "Mar, Jue, Vie - 11:00",
    students: [
      { id: "9", name: "Julia Méndez", avatar: "JM", attendance: { "2024-02-12": "presente", "2024-02-13": "presente", "2024-02-14": "presente", "2024-02-15": null, "2024-02-16": null } },
      { id: "10", name: "Kevin Ortiz", avatar: "KO", attendance: { "2024-02-12": "tardanza", "2024-02-13": "presente", "2024-02-14": "tardanza", "2024-02-15": null, "2024-02-16": null } },
    ],
  },
]

const grades = ["Todos", "4to A", "5to A", "6to B"]
const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie"]
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

export default function AsistenciaAdminPage() {
  const [courses, setCourses] = useState(mockCourses)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedGrade, setSelectedGrade] = useState("Todos")
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date(2024, 1, 12))
  const [searchQuery, setSearchQuery] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [showCourseDropdown, setShowCourseDropdown] = useState(false)

  const filteredCourses = courses.filter((course) => {
    const matchesGrade = selectedGrade === "Todos" || course.grade === selectedGrade
    const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.grade.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesGrade && matchesSearch
  })

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

  const updateAttendance = (courseId: string, studentId: string, date: string, status: AttendanceStatus) => {
    setCourses((prev) =>
      prev.map((course) =>
        course.id === courseId
          ? {
              ...course,
              students: course.students.map((s) =>
                s.id === studentId
                  ? { ...s, attendance: { ...s.attendance, [date]: status } }
                  : s
              ),
            }
          : course
      )
    )
    if (selectedCourse && selectedCourse.id === courseId) {
      setSelectedCourse((prev) =>
        prev
          ? {
              ...prev,
              students: prev.students.map((s) =>
                s.id === studentId
                  ? { ...s, attendance: { ...s.attendance, [date]: status } }
                  : s
              ),
            }
          : null
      )
    }
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
      default:
        return <span className="text-xs">-</span>
    }
  }

  const getCourseStats = (course: Course) => {
    const today = formatDate(weekDates[0])
    const total = course.students.length
    const presentes = course.students.filter((s) => s.attendance[today] === "presente").length
    const ausentes = course.students.filter((s) => s.attendance[today] === "ausente").length
    const tardanzas = course.students.filter((s) => s.attendance[today] === "tardanza").length
    return { total, presentes, ausentes, tardanzas, porcentaje: total > 0 ? Math.round((presentes / total) * 100) : 0 }
  }

  const getGlobalStats = () => {
    const today = formatDate(weekDates[0])
    let totalStudents = 0
    let totalPresentes = 0
    let totalAusentes = 0
    let totalTardanzas = 0

    courses.forEach((course) => {
      course.students.forEach((student) => {
        totalStudents++
        if (student.attendance[today] === "presente") totalPresentes++
        if (student.attendance[today] === "ausente") totalAusentes++
        if (student.attendance[today] === "tardanza") totalTardanzas++
      })
    })

    return {
      total: totalStudents,
      presentes: totalPresentes,
      ausentes: totalAusentes,
      tardanzas: totalTardanzas,
      porcentaje: totalStudents > 0 ? Math.round((totalPresentes / totalStudents) * 100) : 0,
    }
  }

  const globalStats = getGlobalStats()

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Control de Asistencia</h1>
              <p className="mt-1 text-muted-foreground">
                Gestiona la asistencia de todos los cursos
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar Reporte
              </Button>
            </div>
          </div>

          {/* Global Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{courses.length}</p>
                <p className="text-xs text-muted-foreground">Cursos Activos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{globalStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Estudiantes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{globalStats.presentes}</p>
                <p className="text-xs text-muted-foreground">Presentes Hoy</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{globalStats.ausentes}</p>
                <p className="text-xs text-muted-foreground">Ausentes Hoy</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-3xl font-bold text-primary">{globalStats.porcentaje}%</p>
                  {globalStats.porcentaje >= 90 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Asistencia General</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {grades.map((grade) => (
                    <Button
                      key={grade}
                      variant={selectedGrade === grade ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedGrade(grade)
                        setSelectedCourse(null)
                      }}
                    >
                      {grade}
                    </Button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar curso, profesor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full lg:w-64"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course List or Selected Course View */}
          {!selectedCourse ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => {
                const stats = getCourseStats(course)
                return (
                  <Card
                    key={course.id}
                    className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
                    onClick={() => setSelectedCourse(course)}
                  >
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{course.name}</h3>
                          <p className="text-sm text-muted-foreground">{course.grade}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <GraduationCap className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{course.students.length} estudiantes</span>
                        <span className="text-border">•</span>
                        <span>{course.schedule}</span>
                      </div>
                      <div className="mb-3 text-xs text-muted-foreground">{course.teacher}</div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="h-3 w-3 rounded-full bg-green-500" />
                          <span className="text-sm font-medium">{stats.presentes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-3 w-3 rounded-full bg-red-500" />
                          <span className="text-sm font-medium">{stats.ausentes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-3 w-3 rounded-full bg-yellow-500" />
                          <span className="text-sm font-medium">{stats.tardanzas}</span>
                        </div>
                        <div className="ml-auto">
                          <span className={`text-sm font-bold ${stats.porcentaje >= 80 ? "text-green-600" : "text-red-600"}`}>
                            {stats.porcentaje}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div>
              {/* Back button and course info */}
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedCourse(null)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {selectedCourse.name} - {selectedCourse.grade}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedCourse.teacher} • {selectedCourse.schedule}
                    </p>
                  </div>
                </div>
                <Button onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? "Guardar Cambios" : "Editar Asistencia"}
                </Button>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedCourse.students.length} estudiantes
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Table - Desktop */}
              <Card className="hidden lg:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted">
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estudiante</th>
                          {weekDates.map((date, index) => {
                            const isToday = date.getDate() === 12 && date.getMonth() === 1
                            return (
                              <th key={index} className={`px-4 py-3 text-center ${isToday ? "bg-primary/10" : ""}`}>
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-muted-foreground">{weekDays[index]}</span>
                                  <span className={`text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                                    {date.getDate()}
                                  </span>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCourse.students.map((student) => (
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
                                      {(["presente", "ausente", "tardanza", "justificado"] as AttendanceStatus[]).map((s) => (
                                        <button
                                          key={s}
                                          onClick={() => updateAttendance(selectedCourse.id, student.id, dateStr, s)}
                                          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                                            status === s ? getStatusColor(s) : "bg-muted hover:bg-muted-foreground/20"
                                          }`}
                                          title={s?.charAt(0).toUpperCase() + s?.slice(1)}
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
                {selectedCourse.students.map((student) => (
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
                                  onChange={(e) => updateAttendance(selectedCourse.id, student.id, dateStr, (e.target.value || null) as AttendanceStatus)}
                                  className="w-full rounded border border-input bg-background p-1 text-xs"
                                >
                                  <option value="">-</option>
                                  <option value="presente">P</option>
                                  <option value="ausente">A</option>
                                  <option value="tardanza">T</option>
                                  <option value="justificado">J</option>
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
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
