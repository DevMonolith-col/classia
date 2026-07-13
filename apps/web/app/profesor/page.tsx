import Link from "next/link"
import {
  Users,
  BookOpen,
  ClipboardList,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const stats = [
  {
    title: "Clases Hoy",
    value: "4",
    subtitle: "de 6 totales",
    icon: BookOpen,
  },
  {
    title: "Estudiantes",
    value: "128",
    subtitle: "en 4 grupos",
    icon: Users,
  },
  {
    title: "Tareas Pendientes",
    value: "12",
    subtitle: "por calificar",
    icon: ClipboardList,
  },
  {
    title: "Asistencia Promedio",
    value: "94%",
    subtitle: "este mes",
    icon: CheckCircle2,
  },
]

const todaySchedule = [
  {
    id: 1,
    time: "08:00 - 09:30",
    subject: "Matemáticas",
    grade: "5to Grado A",
    room: "Aula 201",
    status: "completed",
  },
  {
    id: 2,
    time: "09:45 - 11:15",
    subject: "Matemáticas",
    grade: "6to Grado B",
    room: "Aula 305",
    status: "completed",
  },
  {
    id: 3,
    time: "11:30 - 13:00",
    subject: "Álgebra",
    grade: "6to Grado A",
    room: "Aula 305",
    status: "current",
  },
  {
    id: 4,
    time: "14:00 - 15:30",
    subject: "Matemáticas",
    grade: "4to Grado A",
    room: "Aula 102",
    status: "upcoming",
  },
]

const pendingTasks = [
  {
    id: 1,
    title: "Examen Parcial - Fracciones",
    grade: "5to Grado A",
    dueDate: "Hoy",
    submissions: 28,
    total: 32,
  },
  {
    id: 2,
    title: "Tarea: Ecuaciones Lineales",
    grade: "6to Grado B",
    dueDate: "Mañana",
    submissions: 20,
    total: 30,
  },
  {
    id: 3,
    title: "Proyecto: Geometría en la vida real",
    grade: "6to Grado A",
    dueDate: "15 Mar",
    submissions: 15,
    total: 28,
  },
]

const recentMessages = [
  {
    id: 1,
    from: "Rosa García",
    role: "Madre de María García",
    message: "Consulta sobre el progreso en matemáticas",
    time: "Hace 1 hora",
    unread: true,
  },
  {
    id: 2,
    from: "Coordinación Académica",
    role: "Administración",
    message: "Recordatorio: Entrega de calificaciones parciales",
    time: "Hace 3 horas",
    unread: true,
  },
  {
    id: 3,
    from: "Carlos Mendoza",
    role: "Padre de Diego Mendoza",
    message: "Gracias por la retroalimentación",
    time: "Ayer",
    unread: false,
  },
]

export default function ProfesorDashboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Buenos días, Prof. López
        </h1>
        <p className="mt-1 text-muted-foreground">
          Lunes, 11 de marzo de 2024 • Tienes 4 clases programadas para hoy
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                  <stat.icon className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horario de Hoy
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profesor/horario" className="gap-1">
                Ver completo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todaySchedule.map((clase) => (
                <div
                  key={clase.id}
                  className={`flex items-center gap-4 rounded-lg border p-4 ${
                    clase.status === "current"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="text-center">
                    <p
                      className={`text-sm font-medium ${
                        clase.status === "completed"
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {clase.time.split(" - ")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {clase.time.split(" - ")[1]}
                    </p>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        clase.status === "completed"
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {clase.subject}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {clase.grade} • {clase.room}
                    </p>
                  </div>
                  <div>
                    {clase.status === "completed" && (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                    {clase.status === "current" && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                        En curso
                      </span>
                    )}
                    {clase.status === "upcoming" && (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tareas por Calificar
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profesor/asignaciones" className="gap-1">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">{task.grade}</p>
                    <div className="mt-2 flex items-center gap-4">
                      <span
                        className={`text-xs font-medium ${
                          task.dueDate === "Hoy"
                            ? "text-warning"
                            : "text-muted-foreground"
                        }`}
                      >
                        {task.dueDate === "Hoy" && (
                          <AlertCircle className="mr-1 inline h-3 w-3" />
                        )}
                        Vence: {task.dueDate}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {task.submissions}/{task.total} entregas
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    Calificar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mensajes Recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profesor/mensajes" className="gap-1">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-4 rounded-lg border p-4 ${
                    message.unread ? "border-primary/30 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <span className="text-sm font-semibold text-foreground">
                      {message.from.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{message.from}</p>
                      {message.unread && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{message.role}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {message.message}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{message.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/profesor/calificaciones/nueva">Registrar Calificaciones</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profesor/asignaciones">Crear Tarea</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profesor/estudiantes">Ver Estudiantes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profesor/mensajes/nuevo">Enviar Mensaje</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
