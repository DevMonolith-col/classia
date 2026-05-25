"use client"

import { useState } from "react"
import {
  FileText,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  BookOpen,
  Upload,
  MessageSquare,
  Star,
  AlertTriangle,
  Send,
  Copy,
  Archive,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TaskStatus = "pendiente" | "en_progreso" | "completada" | "vencida"
type TaskView = "todas" | "activas" | "vencidas" | "calificar"

interface Task {
  id: number
  titulo: string
  curso: string
  cursoId: string
  profesor: string
  fechaAsignacion: string
  fechaEntrega: string
  descripcion: string
  estado: TaskStatus
  entregadas: number
  totalEstudiantes: number
  sinEntregar: number
  calificadas: number
  tipo: "tarea" | "examen" | "proyecto" | "quiz"
  puntuacionMaxima: number
  permiteEnvioTardio: boolean
  archivosAdjuntos: number
}

const tasks: Task[] = [
  {
    id: 1,
    titulo: "Ensayo sobre la Revolución Industrial",
    curso: "5to Grado A - Historia",
    cursoId: "5A",
    profesor: "Prof. García",
    fechaAsignacion: "01 Mar 2024",
    fechaEntrega: "15 Mar 2024",
    descripcion: "Escribir un ensayo de 500 palabras sobre el impacto de la Revolución Industrial",
    estado: "en_progreso",
    entregadas: 18,
    totalEstudiantes: 28,
    sinEntregar: 10,
    calificadas: 12,
    tipo: "tarea",
    puntuacionMaxima: 100,
    permiteEnvioTardio: true,
    archivosAdjuntos: 2,
  },
  {
    id: 2,
    titulo: "Ejercicios de Álgebra - Capítulo 5",
    curso: "6to Grado B - Matemáticas",
    cursoId: "6B",
    profesor: "Prof. López",
    fechaAsignacion: "05 Mar 2024",
    fechaEntrega: "12 Mar 2024",
    descripcion: "Resolver ejercicios del 1 al 20 del libro de texto",
    estado: "vencida",
    entregadas: 22,
    totalEstudiantes: 25,
    sinEntregar: 3,
    calificadas: 22,
    tipo: "tarea",
    puntuacionMaxima: 50,
    permiteEnvioTardio: false,
    archivosAdjuntos: 1,
  },
  {
    id: 3,
    titulo: "Proyecto de Ciencias - Ecosistemas",
    curso: "4to Grado A - Ciencias",
    cursoId: "4A",
    profesor: "Prof. Martínez",
    fechaAsignacion: "20 Feb 2024",
    fechaEntrega: "20 Mar 2024",
    descripcion: "Crear una maqueta de un ecosistema con presentación oral",
    estado: "en_progreso",
    entregadas: 5,
    totalEstudiantes: 30,
    sinEntregar: 25,
    calificadas: 0,
    tipo: "proyecto",
    puntuacionMaxima: 150,
    permiteEnvioTardio: true,
    archivosAdjuntos: 3,
  },
  {
    id: 4,
    titulo: "Quiz de Vocabulario - Unidad 3",
    curso: "3er Grado B - Inglés",
    cursoId: "3B",
    profesor: "Prof. Smith",
    fechaAsignacion: "10 Mar 2024",
    fechaEntrega: "10 Mar 2024",
    descripcion: "Quiz en línea de 20 preguntas sobre vocabulario",
    estado: "completada",
    entregadas: 27,
    totalEstudiantes: 27,
    sinEntregar: 0,
    calificadas: 27,
    tipo: "quiz",
    puntuacionMaxima: 20,
    permiteEnvioTardio: false,
    archivosAdjuntos: 0,
  },
  {
    id: 5,
    titulo: "Examen Parcial - Física",
    curso: "6to Grado A - Física",
    cursoId: "6A",
    profesor: "Prof. Rodríguez",
    fechaAsignacion: "08 Mar 2024",
    fechaEntrega: "18 Mar 2024",
    descripcion: "Examen sobre movimiento rectilíneo y leyes de Newton",
    estado: "pendiente",
    entregadas: 0,
    totalEstudiantes: 26,
    sinEntregar: 26,
    calificadas: 0,
    tipo: "examen",
    puntuacionMaxima: 100,
    permiteEnvioTardio: false,
    archivosAdjuntos: 1,
  },
]

const getStatusConfig = (status: TaskStatus) => {
  switch (status) {
    case "pendiente":
      return {
        label: "Pendiente",
        color: "bg-amber-100 text-amber-700",
        icon: Clock,
      }
    case "en_progreso":
      return {
        label: "En Progreso",
        color: "bg-blue-100 text-blue-700",
        icon: AlertCircle,
      }
    case "completada":
      return {
        label: "Completada",
        color: "bg-green-100 text-green-700",
        icon: CheckCircle2,
      }
    case "vencida":
      return {
        label: "Vencida",
        color: "bg-red-100 text-red-700",
        icon: XCircle,
      }
  }
}

const getTipoConfig = (tipo: Task["tipo"]) => {
  switch (tipo) {
    case "tarea":
      return { label: "Tarea", color: "bg-purple-100 text-purple-700" }
    case "examen":
      return { label: "Examen", color: "bg-red-100 text-red-700" }
    case "proyecto":
      return { label: "Proyecto", color: "bg-emerald-100 text-emerald-700" }
    case "quiz":
      return { label: "Quiz", color: "bg-cyan-100 text-cyan-700" }
  }
}

export default function AdminTareasPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentView, setCurrentView] = useState<TaskView>("todas")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.curso.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (currentView === "todas") return matchesSearch
    if (currentView === "activas") return matchesSearch && (task.estado === "pendiente" || task.estado === "en_progreso")
    if (currentView === "vencidas") return matchesSearch && task.estado === "vencida"
    if (currentView === "calificar") return matchesSearch && task.entregadas > task.calificadas
    return matchesSearch
  })

  const stats = {
    total: tasks.length,
    activas: tasks.filter((t) => t.estado === "pendiente" || t.estado === "en_progreso").length,
    vencidas: tasks.filter((t) => t.estado === "vencida").length,
    porCalificar: tasks.reduce((acc, t) => acc + (t.entregadas - t.calificadas), 0),
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Gestión de Tareas
          </h1>
          <p className="mt-1 text-muted-foreground">
            Administra todas las tareas, proyectos y evaluaciones del colegio
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Tarea
        </Button>
      </div>

      {/* Stats - Estilo Moodle */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all ${currentView === "todas" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setCurrentView("todas")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <FileText className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Tareas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${currentView === "activas" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setCurrentView("activas")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.activas}</p>
                <p className="text-sm text-muted-foreground">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${currentView === "vencidas" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setCurrentView("vencidas")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.vencidas}</p>
                <p className="text-sm text-muted-foreground">Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${currentView === "calificar" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setCurrentView("calificar")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.porCalificar}</p>
                <p className="text-sm text-muted-foreground">Por Calificar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tareas por nombre o curso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-secondary">
                <Filter className="h-4 w-4" />
                Curso
                <ChevronDown className="h-4 w-4" />
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-secondary">
                <Calendar className="h-4 w-4" />
                Fecha
                <ChevronDown className="h-4 w-4" />
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-secondary">
                Tipo
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List - Estilo Moodle */}
      <div className="space-y-4">
        {filteredTasks.map((task) => {
          const statusConfig = getStatusConfig(task.estado)
          const tipoConfig = getTipoConfig(task.tipo)
          const StatusIcon = statusConfig.icon
          const porcentajeEntrega = Math.round((task.entregadas / task.totalEstudiantes) * 100)
          const porcentajeCalificacion = task.entregadas > 0 
            ? Math.round((task.calificadas / task.entregadas) * 100) 
            : 0

          return (
            <Card key={task.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row">
                  {/* Main Info */}
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          {task.tipo === "examen" ? (
                            <FileText className="h-6 w-6 text-foreground" />
                          ) : task.tipo === "proyecto" ? (
                            <BookOpen className="h-6 w-6 text-foreground" />
                          ) : task.tipo === "quiz" ? (
                            <CheckCircle2 className="h-6 w-6 text-foreground" />
                          ) : (
                            <Upload className="h-6 w-6 text-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-foreground">{task.titulo}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipoConfig.color}`}>
                              {tipoConfig.label}
                            </span>
                            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{task.curso}</p>
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-1">{task.descripcion}</p>
                        </div>
                      </div>
                      <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Dates and Meta */}
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Asignado: {task.fechaAsignacion}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span className={task.estado === "vencida" ? "text-red-600 font-medium" : ""}>
                          Entrega: {task.fechaEntrega}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        <span>{task.puntuacionMaxima} pts</span>
                      </div>
                      {task.permiteEnvioTardio && (
                        <span className="text-xs text-amber-600">Permite envío tardío</span>
                      )}
                    </div>
                  </div>

                  {/* Stats Panel - Estilo Moodle */}
                  <div className="border-t border-border bg-secondary/30 p-6 lg:w-80 lg:border-l lg:border-t-0">
                    <div className="space-y-4">
                      {/* Entregas */}
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Entregas</span>
                          <span className="font-medium text-foreground">
                            {task.entregadas}/{task.totalEstudiantes}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${porcentajeEntrega}%` }}
                          />
                        </div>
                        {task.sinEntregar > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {task.sinEntregar} sin entregar
                          </p>
                        )}
                      </div>

                      {/* Calificaciones */}
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Calificadas</span>
                          <span className="font-medium text-foreground">
                            {task.calificadas}/{task.entregadas}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${porcentajeCalificacion}%` }}
                          />
                        </div>
                        {task.entregadas > task.calificadas && (
                          <p className="mt-1 text-xs text-amber-600">
                            {task.entregadas - task.calificadas} pendientes de calificar
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button size="sm" variant="outline" className="gap-1 flex-1">
                          <Eye className="h-3 w-3" />
                          Ver
                        </Button>
                        {task.entregadas > task.calificadas && (
                          <Button size="sm" className="gap-1 flex-1">
                            <Star className="h-3 w-3" />
                            Calificar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredTasks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium text-foreground">No se encontraron tareas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Intenta con otros filtros o crea una nueva tarea
            </p>
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Nueva Tarea
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
