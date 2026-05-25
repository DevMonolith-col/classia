"use client"

import { useState } from "react"
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  FileText,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  Download,
  ChevronDown,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type TaskStatus = "activa" | "cerrada" | "borrador"
type TaskType = "tarea" | "examen" | "proyecto" | "actividad"

interface Task {
  id: string
  title: string
  description: string
  course: string
  type: TaskType
  status: TaskStatus
  dueDate: string
  createdAt: string
  totalStudents: number
  submitted: number
  graded: number
  maxScore: number
  attachments: number
}

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Ejercicios de Ecuaciones Cuadráticas",
    description: "Resolver los ejercicios del 1 al 20 del libro de texto, páginas 45-48",
    course: "Matemáticas 5to A",
    type: "tarea",
    status: "activa",
    dueDate: "2024-02-15",
    createdAt: "2024-02-01",
    totalStudents: 32,
    submitted: 18,
    graded: 12,
    maxScore: 100,
    attachments: 2,
  },
  {
    id: "2",
    title: "Examen Parcial - Álgebra",
    description: "Examen que cubre los temas de factorización, ecuaciones lineales y cuadráticas",
    course: "Matemáticas 5to A",
    type: "examen",
    status: "activa",
    dueDate: "2024-02-20",
    createdAt: "2024-02-05",
    totalStudents: 32,
    submitted: 0,
    graded: 0,
    maxScore: 100,
    attachments: 1,
  },
  {
    id: "3",
    title: "Proyecto: Aplicaciones de la Geometría",
    description: "Investigar y presentar aplicaciones de la geometría en la vida real",
    course: "Matemáticas 6to B",
    type: "proyecto",
    status: "activa",
    dueDate: "2024-03-01",
    createdAt: "2024-02-01",
    totalStudents: 28,
    submitted: 5,
    graded: 0,
    maxScore: 100,
    attachments: 3,
  },
  {
    id: "4",
    title: "Práctica de Fracciones",
    description: "Ejercicios de suma, resta, multiplicación y división de fracciones",
    course: "Matemáticas 4to A",
    type: "actividad",
    status: "cerrada",
    dueDate: "2024-01-30",
    createdAt: "2024-01-15",
    totalStudents: 30,
    submitted: 28,
    graded: 28,
    maxScore: 50,
    attachments: 1,
  },
  {
    id: "5",
    title: "Quiz: Números Decimales",
    description: "Evaluación rápida sobre operaciones con decimales",
    course: "Matemáticas 4to A",
    type: "examen",
    status: "borrador",
    dueDate: "2024-02-25",
    createdAt: "2024-02-10",
    totalStudents: 30,
    submitted: 0,
    graded: 0,
    maxScore: 20,
    attachments: 0,
  },
]

const courses = ["Todos", "Matemáticas 5to A", "Matemáticas 6to B", "Matemáticas 4to A"]
const types = ["Todos", "tarea", "examen", "proyecto", "actividad"]
const statuses = ["Todos", "activa", "cerrada", "borrador"]

export default function TareasProfesorPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCourse, setSelectedCourse] = useState("Todos")
  const [selectedType, setSelectedType] = useState("Todos")
  const [selectedStatus, setSelectedStatus] = useState("Todos")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const filteredTasks = mockTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCourse = selectedCourse === "Todos" || task.course === selectedCourse
    const matchesType = selectedType === "Todos" || task.type === selectedType
    const matchesStatus = selectedStatus === "Todos" || task.status === selectedStatus
    return matchesSearch && matchesCourse && matchesType && matchesStatus
  })

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "activa":
        return "bg-green-100 text-green-800"
      case "cerrada":
        return "bg-muted text-muted-foreground"
      case "borrador":
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const getTypeIcon = (type: TaskType) => {
    switch (type) {
      case "tarea":
        return <FileText className="h-4 w-4" />
      case "examen":
        return <AlertCircle className="h-4 w-4" />
      case "proyecto":
        return <Users className="h-4 w-4" />
      case "actividad":
        return <CheckCircle2 className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: TaskType) => {
    const labels: Record<TaskType, string> = {
      tarea: "Tarea",
      examen: "Examen",
      proyecto: "Proyecto",
      actividad: "Actividad",
    }
    return labels[type]
  }

  const stats = {
    total: mockTasks.length,
    activas: mockTasks.filter((t) => t.status === "activa").length,
    porCalificar: mockTasks.reduce((acc, t) => acc + (t.submitted - t.graded), 0),
    vencenHoy: mockTasks.filter((t) => t.dueDate === "2024-02-15").length,
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Mis Tareas</h1>
              <p className="mt-1 text-muted-foreground">
                Gestiona las tareas, exámenes y actividades de tus cursos
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Tarea
            </Button>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Tareas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.activas}</p>
                    <p className="text-xs text-muted-foreground">Activas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.porCalificar}</p>
                    <p className="text-xs text-muted-foreground">Por Calificar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.vencenHoy}</p>
                    <p className="text-xs text-muted-foreground">Vencen Hoy</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar tareas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 lg:w-auto"
              >
                <Filter className="h-4 w-4" />
                Filtros
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </Button>
            </div>

            {showFilters && (
              <Card>
                <CardContent className="grid gap-4 p-4 lg:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Curso</label>
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {courses.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Tipo</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {types.map((type) => (
                        <option key={type} value={type}>
                          {type === "Todos" ? type : getTypeLabel(type as TaskType)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Estado</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <Card key={task.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Task Info */}
                    <div className="flex-1 p-4 lg:p-6">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {getTypeIcon(task.type)}
                          {getTypeLabel(task.type)}
                        </span>
                        <span className="text-xs text-muted-foreground">{task.course}</span>
                      </div>

                      <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>
                      <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{task.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Vence: {new Date(task.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{task.submitted}/{task.totalStudents} entregas</span>
                        </div>
                        {task.attachments > 0 && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span>{task.attachments} archivos</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress & Actions */}
                    <div className="flex flex-col justify-between border-t bg-muted/30 p-4 lg:w-64 lg:border-l lg:border-t-0">
                      <div className="mb-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Progreso de Calificación</p>
                        <div className="mb-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${task.submitted > 0 ? (task.graded / task.submitted) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {task.graded} de {task.submitted} calificadas
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Ver</span>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1">
                          <Edit className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Editar</span>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTasks.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-medium text-foreground">No se encontraron tareas</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  No hay tareas que coincidan con los filtros seleccionados
                </p>
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crear Nueva Tarea
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <CardTitle>Nueva Tarea</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Título</label>
                  <Input placeholder="Nombre de la tarea" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Descripción</label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Instrucciones detalladas de la tarea..."
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Curso</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>Matemáticas 5to A</option>
                      <option>Matemáticas 6to B</option>
                      <option>Matemáticas 4to A</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Tipo</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="tarea">Tarea</option>
                      <option value="examen">Examen</option>
                      <option value="proyecto">Proyecto</option>
                      <option value="actividad">Actividad</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Fecha de Entrega</label>
                    <Input type="datetime-local" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Puntuación Máxima</label>
                    <Input type="number" placeholder="100" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Archivos Adjuntos</label>
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-input p-6">
                    <div className="text-center">
                      <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Arrastra archivos o <span className="text-primary">haz clic para subir</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" variant="secondary" className="flex-1">
                    Guardar Borrador
                  </Button>
                  <Button type="submit" className="flex-1">
                    Publicar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
