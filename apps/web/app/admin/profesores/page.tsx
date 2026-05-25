"use client"

import { useState } from "react"
import {
  Users,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Mail,
  Phone,
  Calendar,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  BookOpen,
  GraduationCap,
  Clock,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  FileText,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TeacherStatus = "activo" | "inactivo" | "licencia"
type TeacherView = "grid" | "list"

interface Teacher {
  id: number
  nombre: string
  email: string
  telefono: string
  especialidad: string
  cursos: string[]
  totalEstudiantes: number
  fechaIngreso: string
  estado: TeacherStatus
  evaluacion: number
  horasSemanales: number
  tareasAsignadas: number
  avatar: string
  departamento: string
  titulo: string
}

const teachers: Teacher[] = [
  {
    id: 1,
    nombre: "María García Rodríguez",
    email: "maria.garcia@colegio.edu",
    telefono: "+52 55 1234 5678",
    especialidad: "Matemáticas",
    cursos: ["5to Grado A", "6to Grado B"],
    totalEstudiantes: 53,
    fechaIngreso: "15 Ene 2018",
    estado: "activo",
    evaluacion: 4.8,
    horasSemanales: 32,
    tareasAsignadas: 8,
    avatar: "MG",
    departamento: "Ciencias Exactas",
    titulo: "Lic. en Educación Matemática",
  },
  {
    id: 2,
    nombre: "Carlos López Hernández",
    email: "carlos.lopez@colegio.edu",
    telefono: "+52 55 2345 6789",
    especialidad: "Español y Literatura",
    cursos: ["5to Grado B", "4to Grado A"],
    totalEstudiantes: 57,
    fechaIngreso: "20 Ago 2019",
    estado: "activo",
    evaluacion: 4.5,
    horasSemanales: 28,
    tareasAsignadas: 6,
    avatar: "CL",
    departamento: "Humanidades",
    titulo: "Mtro. en Letras Hispánicas",
  },
  {
    id: 3,
    nombre: "Ana Martínez Soto",
    email: "ana.martinez@colegio.edu",
    telefono: "+52 55 3456 7890",
    especialidad: "Ciencias Naturales",
    cursos: ["6to Grado A", "5to Grado A"],
    totalEstudiantes: 54,
    fechaIngreso: "10 Feb 2020",
    estado: "activo",
    evaluacion: 4.9,
    horasSemanales: 30,
    tareasAsignadas: 10,
    avatar: "AM",
    departamento: "Ciencias",
    titulo: "Dra. en Biología",
  },
  {
    id: 4,
    nombre: "Roberto Sánchez Díaz",
    email: "roberto.sanchez@colegio.edu",
    telefono: "+52 55 4567 8901",
    especialidad: "Historia y Geografía",
    cursos: ["6to Grado B"],
    totalEstudiantes: 25,
    fechaIngreso: "05 Mar 2017",
    estado: "activo",
    evaluacion: 4.2,
    horasSemanales: 20,
    tareasAsignadas: 4,
    avatar: "RS",
    departamento: "Ciencias Sociales",
    titulo: "Lic. en Historia",
  },
  {
    id: 5,
    nombre: "Laura Torres Vega",
    email: "laura.torres@colegio.edu",
    telefono: "+52 55 5678 9012",
    especialidad: "Inglés",
    cursos: ["4to Grado A", "3er Grado B", "5to Grado B"],
    totalEstudiantes: 79,
    fechaIngreso: "12 Jul 2021",
    estado: "activo",
    evaluacion: 4.7,
    horasSemanales: 36,
    tareasAsignadas: 12,
    avatar: "LT",
    departamento: "Idiomas",
    titulo: "CELTA Certified",
  },
  {
    id: 6,
    nombre: "Pedro Ramírez Luna",
    email: "pedro.ramirez@colegio.edu",
    telefono: "+52 55 6789 0123",
    especialidad: "Educación Física",
    cursos: ["Todos los grados"],
    totalEstudiantes: 180,
    fechaIngreso: "01 Sep 2016",
    estado: "activo",
    evaluacion: 4.6,
    horasSemanales: 40,
    tareasAsignadas: 2,
    avatar: "PR",
    departamento: "Deportes",
    titulo: "Lic. en Educación Física",
  },
  {
    id: 7,
    nombre: "Carmen Vega Flores",
    email: "carmen.vega@colegio.edu",
    telefono: "+52 55 7890 1234",
    especialidad: "Arte y Música",
    cursos: ["3er Grado A", "3er Grado B"],
    totalEstudiantes: 44,
    fechaIngreso: "15 Ene 2022",
    estado: "licencia",
    evaluacion: 4.4,
    horasSemanales: 0,
    tareasAsignadas: 0,
    avatar: "CV",
    departamento: "Artes",
    titulo: "Lic. en Bellas Artes",
  },
  {
    id: 8,
    nombre: "Fernando Morales Ruiz",
    email: "fernando.morales@colegio.edu",
    telefono: "+52 55 8901 2345",
    especialidad: "Computación",
    cursos: ["5to Grado A", "5to Grado B", "6to Grado A", "6to Grado B"],
    totalEstudiantes: 106,
    fechaIngreso: "08 Ago 2020",
    estado: "activo",
    evaluacion: 4.3,
    horasSemanales: 24,
    tareasAsignadas: 5,
    avatar: "FM",
    departamento: "Tecnología",
    titulo: "Ing. en Sistemas",
  },
]

const getStatusConfig = (status: TeacherStatus) => {
  switch (status) {
    case "activo":
      return { label: "Activo", color: "bg-green-100 text-green-700", icon: CheckCircle2 }
    case "inactivo":
      return { label: "Inactivo", color: "bg-gray-100 text-gray-700", icon: XCircle }
    case "licencia":
      return { label: "En Licencia", color: "bg-amber-100 text-amber-700", icon: AlertCircle }
  }
}

const getEvaluacionColor = (evaluacion: number) => {
  if (evaluacion >= 4.5) return "text-green-600"
  if (evaluacion >= 4.0) return "text-amber-600"
  return "text-red-600"
}

export default function AdminProfesoresPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<TeacherView>("grid")
  const [filterStatus, setFilterStatus] = useState<TeacherStatus | "todos">("todos")
  const [filterDepartamento, setFilterDepartamento] = useState<string>("todos")

  const departamentos = [...new Set(teachers.map((t) => t.departamento))]

  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSearch =
      teacher.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.especialidad.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = filterStatus === "todos" || teacher.estado === filterStatus
    const matchesDepartamento = filterDepartamento === "todos" || teacher.departamento === filterDepartamento
    
    return matchesSearch && matchesStatus && matchesDepartamento
  })

  const stats = {
    total: teachers.length,
    activos: teachers.filter((t) => t.estado === "activo").length,
    horasTotales: teachers.reduce((acc, t) => acc + t.horasSemanales, 0),
    promedioEvaluacion: (teachers.reduce((acc, t) => acc + t.evaluacion, 0) / teachers.length).toFixed(1),
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Gestión de Profesores
          </h1>
          <p className="mt-1 text-muted-foreground">
            Administra el equipo docente de tu institución
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Profesor
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <Users className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Profesores</p>
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
                <p className="text-sm text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.horasTotales}</p>
                <p className="text-sm text-muted-foreground">Horas/Semana</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.promedioEvaluacion}</p>
                <p className="text-sm text-muted-foreground">Evaluación Prom.</p>
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
                placeholder="Buscar profesores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-secondary">
                <Filter className="h-4 w-4" />
                Estado
                <ChevronDown className="h-4 w-4" />
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-secondary">
                Departamento
                <ChevronDown className="h-4 w-4" />
              </button>
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

      {/* Teachers Grid */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTeachers.map((teacher) => {
            const statusConfig = getStatusConfig(teacher.estado)
            const StatusIcon = statusConfig.icon

            return (
              <Card key={teacher.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                        {teacher.avatar}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{teacher.nombre}</h3>
                        <p className="text-sm text-muted-foreground">{teacher.especialidad}</p>
                      </div>
                    </div>
                    <button className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{teacher.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{teacher.telefono}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Award className="h-4 w-4" />
                      <span className="truncate">{teacher.titulo}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-secondary/50 p-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{teacher.cursos.length}</p>
                      <p className="text-xs text-muted-foreground">Cursos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{teacher.totalEstudiantes}</p>
                      <p className="text-xs text-muted-foreground">Estudiantes</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${getEvaluacionColor(teacher.evaluacion)}`}>
                        {teacher.evaluacion}
                      </p>
                      <p className="text-xs text-muted-foreground">Evaluación</p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <Eye className="h-3 w-3" />
                      Perfil
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1">
                      <MessageSquare className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Edit className="h-3 w-3" />
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Profesor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Especialidad</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Contacto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Cursos</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Evaluación</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => {
                  const statusConfig = getStatusConfig(teacher.estado)
                  const StatusIcon = statusConfig.icon

                  return (
                    <tr key={teacher.id} className="border-b border-border hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {teacher.avatar}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{teacher.nombre}</p>
                            <p className="text-sm text-muted-foreground">{teacher.departamento}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{teacher.especialidad}</p>
                        <p className="text-xs text-muted-foreground">{teacher.titulo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{teacher.email}</p>
                        <p className="text-xs text-muted-foreground">{teacher.telefono}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{teacher.cursos.length} cursos</p>
                        <p className="text-xs text-muted-foreground">{teacher.totalEstudiantes} estudiantes</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Star className={`h-4 w-4 ${getEvaluacionColor(teacher.evaluacion)}`} />
                          <span className={`font-medium ${getEvaluacionColor(teacher.evaluacion)}`}>
                            {teacher.evaluacion}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <MessageSquare className="h-4 w-4" />
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

      {filteredTeachers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium text-foreground">No se encontraron profesores</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Intenta con otros filtros o agrega un nuevo profesor
            </p>
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Profesor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
