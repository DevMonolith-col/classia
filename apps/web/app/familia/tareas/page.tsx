"use client"

import { useState } from "react"
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  ChevronRight,
  BookOpen,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type TaskStatus = "pendiente" | "entregada" | "calificada" | "atrasada"

interface Task {
  id: string
  title: string
  description: string
  course: string
  subject: string
  teacher: string
  type: string
  status: TaskStatus
  dueDate: string
  submittedAt?: string
  grade?: number
  maxScore: number
  feedback?: string
  attachments: { name: string; url: string }[]
}

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Ejercicios de Ecuaciones Cuadráticas",
    description: "Resolver los ejercicios del 1 al 20 del libro de texto, páginas 45-48. Mostrar todo el procedimiento.",
    course: "5to Grado A",
    subject: "Matemáticas",
    teacher: "Prof. Juan López",
    type: "Tarea",
    status: "pendiente",
    dueDate: "2024-02-15T23:59:00",
    maxScore: 100,
    attachments: [
      { name: "Guia_Ecuaciones.pdf", url: "#" },
    ],
  },
  {
    id: "2",
    title: "Ensayo: La Revolución Industrial",
    description: "Escribir un ensayo de 500 palabras sobre el impacto de la Revolución Industrial en la sociedad moderna.",
    course: "5to Grado A",
    subject: "Historia",
    teacher: "Prof. Ana Martínez",
    type: "Tarea",
    status: "entregada",
    dueDate: "2024-02-12T23:59:00",
    submittedAt: "2024-02-11T18:30:00",
    maxScore: 100,
    attachments: [],
  },
  {
    id: "3",
    title: "Proyecto de Ciencias: Ecosistemas",
    description: "Crear una maqueta de un ecosistema local y presentar un informe escrito.",
    course: "5to Grado A",
    subject: "Ciencias Naturales",
    teacher: "Prof. Carlos Ruiz",
    type: "Proyecto",
    status: "calificada",
    dueDate: "2024-02-08T23:59:00",
    submittedAt: "2024-02-07T20:15:00",
    grade: 92,
    maxScore: 100,
    feedback: "Excelente trabajo. La maqueta está muy bien detallada y el informe es completo. Sigue así.",
    attachments: [],
  },
  {
    id: "4",
    title: "Práctica de Gramática",
    description: "Completar los ejercicios de la página 78 del libro de Español.",
    course: "5to Grado A",
    subject: "Español",
    teacher: "Prof. María González",
    type: "Actividad",
    status: "atrasada",
    dueDate: "2024-02-05T23:59:00",
    maxScore: 50,
    attachments: [],
  },
  {
    id: "5",
    title: "Examen Parcial - Álgebra",
    description: "Examen que cubre los temas de factorización, ecuaciones lineales y cuadráticas.",
    course: "5to Grado A",
    subject: "Matemáticas",
    teacher: "Prof. Juan López",
    type: "Examen",
    status: "pendiente",
    dueDate: "2024-02-20T10:00:00",
    maxScore: 100,
    attachments: [
      { name: "Temario_Examen.pdf", url: "#" },
    ],
  },
]

const subjects = ["Todos", "Matemáticas", "Historia", "Ciencias Naturales", "Español"]
const statusFilters = ["Todos", "pendiente", "entregada", "calificada", "atrasada"]

export default function TareasFamiliaPage() {
  const [selectedSubject, setSelectedSubject] = useState("Todos")
  const [selectedStatus, setSelectedStatus] = useState("Todos")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const filteredTasks = mockTasks.filter((task) => {
    const matchesSubject = selectedSubject === "Todos" || task.subject === selectedSubject
    const matchesStatus = selectedStatus === "Todos" || task.status === selectedStatus
    return matchesSubject && matchesStatus
  })

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case "pendiente":
        return { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pendiente" }
      case "entregada":
        return { color: "bg-blue-100 text-blue-800", icon: CheckCircle2, label: "Entregada" }
      case "calificada":
        return { color: "bg-green-100 text-green-800", icon: CheckCircle2, label: "Calificada" }
      case "atrasada":
        return { color: "bg-red-100 text-red-800", icon: AlertCircle, label: "Atrasada" }
    }
  }

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const stats = {
    pendientes: mockTasks.filter((t) => t.status === "pendiente").length,
    entregadas: mockTasks.filter((t) => t.status === "entregada").length,
    calificadas: mockTasks.filter((t) => t.status === "calificada").length,
    atrasadas: mockTasks.filter((t) => t.status === "atrasada").length,
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Tareas</h1>
            <p className="mt-1 text-muted-foreground">
              Revisa y entrega las tareas de María
            </p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground">{stats.pendientes}</p>
                <p className="text-sm text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground">{stats.entregadas}</p>
                <p className="text-sm text-muted-foreground">Entregadas</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground">{stats.calificadas}</p>
                <p className="text-sm text-muted-foreground">Calificadas</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground">{stats.atrasadas}</p>
                <p className="text-sm text-muted-foreground">Atrasadas</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="mb-4 gap-2 lg:hidden"
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>

            <div className={`flex flex-col gap-3 lg:flex-row ${showFilters ? "block" : "hidden lg:flex"}`}>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <Button
                    key={subject}
                    variant={selectedSubject === subject ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSubject(subject)}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 lg:ml-auto">
                {statusFilters.map((status) => (
                  <Button
                    key={status}
                    variant={selectedStatus === status ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedStatus(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {filteredTasks.map((task) => {
              const statusConfig = getStatusConfig(task.status)
              const daysRemaining = getDaysRemaining(task.dueDate)

              return (
                <Card
                  key={task.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setSelectedTask(task)}
                >
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.color}`}>
                            <statusConfig.icon className="h-3 w-3" />
                            {statusConfig.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            {task.type}
                          </span>
                          <span className="text-xs text-muted-foreground">{task.subject}</span>
                        </div>

                        <h3 className="mb-1 text-lg font-semibold text-foreground">{task.title}</h3>
                        <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{task.description}</p>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{task.teacher}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(task.dueDate).toLocaleDateString("es-ES", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {task.status === "pendiente" && daysRemaining > 0 && (
                            <span className={`font-medium ${daysRemaining <= 2 ? "text-red-600" : "text-foreground"}`}>
                              {daysRemaining} día{daysRemaining !== 1 ? "s" : ""} restante{daysRemaining !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {task.status === "calificada" && task.grade !== undefined && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">{task.grade}</p>
                            <p className="text-xs text-muted-foreground">/ {task.maxScore}</p>
                          </div>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-medium text-foreground">No hay tareas</h3>
                <p className="text-center text-sm text-muted-foreground">
                  No se encontraron tareas con los filtros seleccionados
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusConfig(selectedTask.status).color}`}>
                      {getStatusConfig(selectedTask.status).label}
                    </span>
                    <span className="text-xs text-muted-foreground">{selectedTask.subject}</span>
                  </div>
                  <CardTitle>{selectedTask.title}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Info */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Profesor</p>
                    <p className="text-sm text-foreground">{selectedTask.teacher}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Fecha de Entrega</p>
                    <p className="text-sm text-foreground">
                      {new Date(selectedTask.dueDate).toLocaleDateString("es-ES", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Puntuación Máxima</p>
                    <p className="text-sm text-foreground">{selectedTask.maxScore} puntos</p>
                  </div>
                  {selectedTask.submittedAt && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Fecha de Entrega</p>
                      <p className="text-sm text-foreground">
                        {new Date(selectedTask.submittedAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Instrucciones</p>
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                </div>

                {/* Attachments */}
                {selectedTask.attachments.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Archivos Adjuntos</p>
                    <div className="space-y-2">
                      {selectedTask.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg border border-input p-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{file.name}</span>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grade & Feedback */}
                {selectedTask.status === "calificada" && (
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-green-800">Calificación</p>
                      <p className="text-2xl font-bold text-green-800">
                        {selectedTask.grade} / {selectedTask.maxScore}
                      </p>
                    </div>
                    {selectedTask.feedback && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-green-700">Comentarios del profesor:</p>
                        <p className="text-sm text-green-800">{selectedTask.feedback}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Section */}
                {(selectedTask.status === "pendiente" || selectedTask.status === "atrasada") && (
                  <div className="rounded-lg border-2 border-dashed border-input p-6">
                    <div className="text-center">
                      <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="mb-2 text-sm font-medium text-foreground">Entregar Tarea</p>
                      <p className="mb-4 text-xs text-muted-foreground">
                        Arrastra archivos o haz clic para subir
                      </p>
                      <Button>Subir Archivo</Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
