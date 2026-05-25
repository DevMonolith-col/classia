import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  MessageSquare,
  Bell,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const studentInfo = {
  name: "María García López",
  grade: "5to Grado A",
  avatar: "MG",
  teacher: "Prof. Juan López",
}

const quickStats = [
  {
    title: "Promedio General",
    value: "91.4",
    change: "+2.3",
    trend: "up",
    subtitle: "vs. periodo anterior",
  },
  {
    title: "Asistencia",
    value: "96%",
    change: "+1%",
    trend: "up",
    subtitle: "este mes",
  },
  {
    title: "Tareas Entregadas",
    value: "18/20",
    change: "-2",
    trend: "down",
    subtitle: "pendientes",
  },
]

const recentGrades = [
  {
    id: 1,
    subject: "Matemáticas",
    assignment: "Examen Parcial 2",
    grade: 95,
    date: "Hoy",
  },
  {
    id: 2,
    subject: "Español",
    assignment: "Ensayo Literario",
    grade: 88,
    date: "Ayer",
  },
  {
    id: 3,
    subject: "Ciencias",
    assignment: "Proyecto Ecosistemas",
    grade: 92,
    date: "10 Mar",
  },
  {
    id: 4,
    subject: "Historia",
    assignment: "Cuestionario Cap. 5",
    grade: 85,
    date: "8 Mar",
  },
]

const pendingTasks = [
  {
    id: 1,
    subject: "Matemáticas",
    title: "Ejercicios: Fracciones mixtas",
    dueDate: "Mañana",
    status: "pending",
  },
  {
    id: 2,
    subject: "Español",
    title: "Lectura: Capítulo 8",
    dueDate: "14 Mar",
    status: "pending",
  },
  {
    id: 3,
    subject: "Ciencias",
    title: "Investigación: Energías renovables",
    dueDate: "18 Mar",
    status: "in-progress",
  },
]

const upcomingEvents = [
  {
    id: 1,
    title: "Reunión de Padres",
    date: "15 Mar",
    time: "16:00",
  },
  {
    id: 2,
    title: "Examen de Español",
    date: "18 Mar",
    time: "08:00",
  },
  {
    id: 3,
    title: "Festival de Primavera",
    date: "22 Mar",
    time: "10:00",
  },
]

const notifications = [
  {
    id: 1,
    type: "grade",
    message: "Nueva calificación en Matemáticas: 95",
    time: "Hace 2 horas",
    read: false,
  },
  {
    id: 2,
    type: "message",
    message: "Mensaje de Prof. López",
    time: "Hace 5 horas",
    read: false,
  },
  {
    id: 3,
    type: "event",
    message: "Recordatorio: Reunión de padres el 15 de marzo",
    time: "Ayer",
    read: true,
  },
]

export default function FamiliaDashboardPage() {
  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-success"
    if (grade >= 70) return "text-foreground"
    return "text-destructive"
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {studentInfo.avatar}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {studentInfo.name}
            </h1>
            <p className="text-muted-foreground">
              {studentInfo.grade} • Tutor: {studentInfo.teacher}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/familia/mensajes/nuevo">Contactar Profesor</Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {quickStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    stat.trend === "up" ? "text-success" : "text-destructive"
                  }`}
                >
                  {stat.trend === "up" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {stat.change}
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Grades */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Calificaciones Recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/calificaciones" className="gap-1">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentGrades.map((grade) => (
                <div
                  key={grade.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{grade.subject}</p>
                    <p className="text-sm text-muted-foreground">{grade.assignment}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getGradeColor(grade.grade)}`}>
                      {grade.grade}
                    </p>
                    <p className="text-xs text-muted-foreground">{grade.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/notificaciones">
                Ver todas
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-3 ${
                    notification.read
                      ? "border-border"
                      : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <p className="text-sm text-foreground">{notification.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{notification.time}</p>
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
              Tareas Pendientes
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/tareas">
                Ver todas
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.subject}</p>
                    </div>
                    {task.status === "in-progress" ? (
                      <Clock className="h-4 w-4 text-warning" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p
                    className={`mt-2 text-xs font-medium ${
                      task.dueDate === "Mañana" ? "text-warning" : "text-muted-foreground"
                    }`}
                  >
                    Entrega: {task.dueDate}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/familia/horario">
                Ver calendario
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <span className="text-xs font-medium">{event.date.split(" ")[0]}</span>
                    <span className="text-xs">{event.date.split(" ")[1]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link href="/familia/calificaciones">
                  <CheckCircle2 className="h-4 w-4" />
                  Ver Calificaciones
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link href="/familia/asistencia">
                  <Calendar className="h-4 w-4" />
                  Ver Asistencia
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link href="/familia/mensajes">
                  <MessageSquare className="h-4 w-4" />
                  Mensajes
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
