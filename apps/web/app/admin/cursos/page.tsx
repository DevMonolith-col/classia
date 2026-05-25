"use client"

import { useState } from "react"
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Users,
  Clock,
  Calendar,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  GraduationCap,
  User,
  FileText,
  BarChart3,
  CheckCircle2,
  XCircle,
  Copy,
  Archive,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CourseStatus = "activo" | "inactivo" | "proximo"
type CourseView = "grid" | "list"

interface Course {
  id: number
  nombre: string
  codigo: string
  grado: string
  seccion: string
  profesor: string
  profesorId: number
  horario: string
  aula: string
  estudiantes: number
  capacidad: number
  estado: CourseStatus
  materias: string[]
  promedioGeneral: number
  asistenciaPromedio: number
  tareasActivas: number
  color: string
}

const courses: Course[] = [
  {
    id: 1,
    nombre: "5to Grado A",
    codigo: "5A-2024",
    grado: "5to Grado",
    seccion: "A",
    profesor: "Prof. María García",
    profesorId: 1,
    horario: "Lun-Vie 7:30-12:30",
    aula: "Aula 101",
    estudiantes: 28,
    capacidad: 30,
    estado: "activo",
    materias: ["Matemáticas", "Español", "Ciencias", "Historia", "Inglés"],
    promedioGeneral: 85.5,
    asistenciaPromedio: 94.2,
    tareasActivas: 4,
    color: "bg-blue-500",
  },
  {
    id: 2,
    nombre: "5to Grado B",
    codigo: "5B-2024",
    grado: "5to Grado",
    seccion: "B",
    profesor: "Prof. Carlos López",
    profesorId: 2,
    horario: "Lun-Vie 7:30-12:30",
    aula: "Aula 102",
    estudiantes: 27,
    capacidad: 30,
    estado: "activo",
    materias: ["Matemáticas", "Español", "Ciencias", "Historia", "Inglés"],
    promedioGeneral: 82.3,
    asistenciaPromedio: 91.8,
    tareasActivas: 3,
    color: "bg-emerald-500",
  },
  {
    id: 3,
    nombre: "6to Grado A",
    codigo: "6A-2024",
    grado: "6to Grado",
    seccion: "A",
    profesor: "Prof. Ana Martínez",
    profesorId: 3,
    horario: "Lun-Vie 7:30-12:30",
    aula: "Aula 201",
    estudiantes: 26,
    capacidad: 30,
    estado: "activo",
    materias: ["Matemáticas", "Español", "Física", "Química", "Inglés"],
    promedioGeneral: 88.1,
    asistenciaPromedio: 96.5,
    tareasActivas: 5,
    color: "bg-purple-500",
  },
  {
    id: 4,
    nombre: "6to Grado B",
    codigo: "6B-2024",
    grado: "6to Grado",
    seccion: "B",
    profesor: "Prof. Roberto Sánchez",
    profesorId: 4,
    horario: "Lun-Vie 7:30-12:30",
    aula: "Aula 202",
    estudiantes: 25,
    capacidad: 30,
    estado: "activo",
    materias: ["Matemáticas", "Español", "Física", "Química", "Inglés"],
    promedioGeneral: 79.8,
    asistenciaPromedio: 89.3,
    tareasActivas: 2,
    color: "bg-amber-500",
  },
  {
    id: 5,
    nombre: "4to Grado A",
    codigo: "4A-2024",
    grado: "4to Grado",
    seccion: "A",
    profesor: "Prof. Laura Torres",
    profesorId: 5,
    horario: "Lun-Vie 7:30-12:30",
    aula: "Aula 103",
    estudiantes: 30,
    capacidad: 30,
    estado: "activo",
    materias: ["Matemáticas", "Español", "Ciencias", "Arte", "Educación Física"],
    promedioGeneral: 90.2,
    asistenciaPromedio: 97.1,
    tareasActivas: 6,
    color: "bg-rose-500",
  },
  {
    id: 6,
    nombre: "3er Grado B",
    codigo: "3B-2024",
    grado: "3er Grado",
    seccion: "B",
    profesor: "Prof. Pedro Ramírez",
    profesorId: 6,
    horario: "Lun-Vie 7:30-12:30",
    aula: "Aula 104",
    estudiantes: 22,
    capacidad: 28,
    estado: "activo",
    materias: ["Matemáticas", "Español", "Ciencias", "Arte", "Música"],
    promedioGeneral: 86.7,
    asistenciaPromedio: 93.4,
    tareasActivas: 3,
    color: "bg-cyan-500",
  },
  {
    id: 7,
    nombre: "Curso de Verano - Inglés",
    codigo: "VER-ING-2024",
    grado: "Mixto",
    seccion: "-",
    profesor: "Prof. Smith",
    profesorId: 7,
    horario: "Lun-Mie-Vie 9:00-11:00",
    aula: "Aula 301",
    estudiantes: 0,
    capacidad: 20,
    estado: "proximo",
    materias: ["Inglés Intensivo"],
    promedioGeneral: 0,
    asistenciaPromedio: 0,
    tareasActivas: 0,
    color: "bg-indigo-500",
  },
  {
    id: 8,
    nombre: "Taller de Arte",
    codigo: "TAL-ART-2023",
    grado: "Mixto",
    seccion: "-",
    profesor: "Prof. Carmen Vega",
    profesorId: 8,
    horario: "Sábados 10:00-12:00",
    aula: "Taller de Arte",
    estudiantes: 15,
    capacidad: 20,
    estado: "inactivo",
    materias: ["Pintura", "Dibujo", "Escultura"],
    promedioGeneral: 92.0,
    asistenciaPromedio: 88.5,
    tareasActivas: 0,
    color: "bg-pink-500",
  },
]

const getStatusConfig = (status: CourseStatus) => {
  switch (status) {
    case "activo":
      return { label: "Activo", color: "bg-green-100 text-green-700", icon: CheckCircle2 }
    case "inactivo":
      return { label: "Inactivo", color: "bg-gray-100 text-gray-700", icon: XCircle }
    case "proximo":
      return { label: "Próximo", color: "bg-blue-100 text-blue-700", icon: Calendar }
  }
}

export default function AdminCursosPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<CourseView>("grid")
  const [filterStatus, setFilterStatus] = useState<CourseStatus | "todos">("todos")

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.profesor.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (filterStatus === "todos") return matchesSearch
    return matchesSearch && course.estado === filterStatus
  })

  const stats = {
    total: courses.length,
    activos: courses.filter((c) => c.estado === "activo").length,
    estudiantes: courses.reduce((acc, c) => acc + c.estudiantes, 0),
    capacidadTotal: courses.reduce((acc, c) => acc + c.capacidad, 0),
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Gestión de Cursos
          </h1>
          <p className="mt-1 text-muted-foreground">
            Administra los cursos, secciones y asignaciones del colegio
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Curso
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <BookOpen className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Cursos</p>
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
                <p className="text-2xl font-bold text-foreground">{stats.activos}</p>
                <p className="text-sm text-muted-foreground">Cursos Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <GraduationCap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.estudiantes}</p>
                <p className="text-sm text-muted-foreground">Estudiantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Math.round((stats.estudiantes / stats.capacidadTotal) * 100)}%
                </p>
                <p className="text-sm text-muted-foreground">Ocupación</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cursos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-input bg-background p-1">
                {(["todos", "activo", "inactivo", "proximo"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      filterStatus === status
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status === "todos" ? "Todos" : status === "activo" ? "Activos" : status === "inactivo" ? "Inactivos" : "Próximos"}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-input bg-background p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-secondary" : ""}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-secondary" : ""}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCourses.map((course) => {
            const statusConfig = getStatusConfig(course.estado)
            const StatusIcon = statusConfig.icon
            const ocupacion = Math.round((course.estudiantes / course.capacidad) * 100)

            return (
              <Card key={course.id} className="overflow-hidden">
                <div className={`h-2 ${course.color}`} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </span>
                      <h3 className="mt-2 font-semibold text-foreground">{course.nombre}</h3>
                      <p className="text-sm text-muted-foreground">{course.codigo}</p>
                    </div>
                    <button className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="truncate">{course.profesor}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{course.horario}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      <span>{course.aula}</span>
                    </div>
                  </div>

                  {/* Capacidad */}
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Estudiantes</span>
                      <span className="font-medium text-foreground">{course.estudiantes}/{course.capacidad}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full transition-all ${ocupacion >= 90 ? "bg-red-500" : ocupacion >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${ocupacion}%` }}
                      />
                    </div>
                  </div>

                  {course.estado === "activo" && (
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-secondary/50 p-3">
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{course.promedioGeneral.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Promedio</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{course.asistenciaPromedio.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Asistencia</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{course.tareasActivas}</p>
                        <p className="text-xs text-muted-foreground">Tareas</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <Eye className="h-3 w-3" />
                      Ver
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <Edit className="h-3 w-3" />
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Curso</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Profesor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Horario</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estudiantes</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Promedio</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => {
                  const statusConfig = getStatusConfig(course.estado)
                  const StatusIcon = statusConfig.icon

                  return (
                    <tr key={course.id} className="border-b border-border hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-1 rounded-full ${course.color}`} />
                          <div>
                            <p className="font-medium text-foreground">{course.nombre}</p>
                            <p className="text-sm text-muted-foreground">{course.codigo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{course.profesor}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{course.horario}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{course.estudiantes}/{course.capacidad}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {course.estado === "activo" ? course.promedioGeneral.toFixed(1) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filteredCourses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium text-foreground">No se encontraron cursos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Intenta con otros filtros o crea un nuevo curso
            </p>
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Curso
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
