import {
  Users,
  GraduationCap,
  Calendar,
  MessageSquare,
  BarChart3,
  Shield,
  Bell,
  FileText,
} from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Gestión de Usuarios",
    description:
      "Administra estudiantes, profesores y personal administrativo con perfiles completos y roles personalizados.",
  },
  {
    icon: GraduationCap,
    title: "Control Académico",
    description:
      "Registra calificaciones, asistencia y progreso académico de cada estudiante en tiempo real.",
  },
  {
    icon: Calendar,
    title: "Horarios y Calendario",
    description:
      "Planifica clases, eventos y actividades escolares con un calendario integrado y sincronizado.",
  },
  {
    icon: MessageSquare,
    title: "Comunicación Integrada",
    description:
      "Mensajería directa entre profesores, padres y administradores para una comunicación efectiva.",
  },
  {
    icon: BarChart3,
    title: "Reportes y Analíticas",
    description:
      "Genera reportes detallados sobre rendimiento académico, asistencia y tendencias institucionales.",
  },
  {
    icon: Shield,
    title: "Seguridad Multi-tenant",
    description:
      "Datos aislados por institución con encriptación y cumplimiento de normativas de privacidad.",
  },
  {
    icon: Bell,
    title: "Notificaciones",
    description:
      "Alertas automáticas para padres sobre calificaciones, tareas pendientes y eventos importantes.",
  },
  {
    icon: FileText,
    title: "Documentación Digital",
    description:
      "Almacena y gestiona documentos escolares, certificados y expedientes de forma segura.",
  },
]

export function LandingFeatures() {
  return (
    <section id="caracteristicas" className="bg-secondary py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Características
          </h2>
          <p className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Todo lo que necesitas para gestionar tu institución
          </p>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Herramientas diseñadas específicamente para las necesidades del sector educativo latinoamericano.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-border bg-card p-6 transition-all hover:border-accent hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
