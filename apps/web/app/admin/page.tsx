import {
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  MessageSquare,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const stats = [
  {
    title: "Total Estudiantes",
    value: "1,248",
    change: "+12%",
    trend: "up",
    icon: GraduationCap,
  },
  {
    title: "Profesores Activos",
    value: "64",
    change: "+3",
    trend: "up",
    icon: Users,
  },
  {
    title: "Cursos Activos",
    value: "32",
    change: "0",
    trend: "neutral",
    icon: BookOpen,
  },
  {
    title: "Asistencia Hoy",
    value: "94.2%",
    change: "-1.8%",
    trend: "down",
    icon: AlertCircle,
  },
]

const recentActivity = [
  {
    id: 1,
    type: "enrollment",
    message: "María García se inscribió en 5to Grado A",
    time: "Hace 5 min",
  },
  {
    id: 2,
    type: "grade",
    message: "Prof. López registró calificaciones de Matemáticas",
    time: "Hace 15 min",
  },
  {
    id: 3,
    type: "message",
    message: "Nuevo mensaje de padre de familia",
    time: "Hace 30 min",
  },
  {
    id: 4,
    type: "attendance",
    message: "Reporte de asistencia de 3er Grado completado",
    time: "Hace 1 hora",
  },
  {
    id: 5,
    type: "event",
    message: "Reunión de padres programada para el 15 de marzo",
    time: "Hace 2 horas",
  },
]

const upcomingEvents = [
  {
    id: 1,
    title: "Reunión de Profesores",
    date: "Hoy",
    time: "14:00",
  },
  {
    id: 2,
    title: "Entrega de Boletines",
    date: "Mañana",
    time: "08:00",
  },
  {
    id: 3,
    title: "Día del Estudiante",
    date: "15 Mar",
    time: "Todo el día",
  },
]

export default function AdminDashboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Panel de Administración
        </h1>
        <p className="mt-1 text-muted-foreground">
          Bienvenido de vuelta. Aquí está el resumen de tu institución.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                  <stat.icon className="h-6 w-6 text-foreground" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    stat.trend === "up"
                      ? "text-success"
                      : stat.trend === "down"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {stat.trend === "up" && <TrendingUp className="h-4 w-4" />}
                  {stat.trend === "down" && <TrendingDown className="h-4 w-4" />}
                  {stat.change}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Actividad Reciente</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/actividad" className="gap-1">
                Ver todo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 rounded-lg border border-border p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                    {activity.type === "enrollment" && (
                      <GraduationCap className="h-5 w-5 text-foreground" />
                    )}
                    {activity.type === "grade" && (
                      <BookOpen className="h-5 w-5 text-foreground" />
                    )}
                    {activity.type === "message" && (
                      <MessageSquare className="h-5 w-5 text-foreground" />
                    )}
                    {activity.type === "attendance" && (
                      <Users className="h-5 w-5 text-foreground" />
                    )}
                    {activity.type === "event" && (
                      <Calendar className="h-5 w-5 text-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Próximos Eventos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/calendario" className="gap-1">
                Ver calendario
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 rounded-lg border border-border p-4"
                >
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <span className="text-xs font-medium">{event.date.split(" ")[0]}</span>
                    {event.date.split(" ")[1] && (
                      <span className="text-xs">{event.date.split(" ")[1]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.time}</p>
                  </div>
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
              <Link href="/admin/estudiantes/nuevo">Agregar Estudiante</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/profesores/nuevo">Agregar Profesor</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/cursos/nuevo">Crear Curso</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/mensajes/nuevo">Enviar Mensaje</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/reportes">Generar Reporte</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
