import Link from "next/link"
import {
  ArrowRight,
  CalendarSync,
  CreditCard,
  Info,
  Lock,
  MessageSquare,
  Puzzle,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Pantalla informativa, a propósito sin backend: los plugins quedaron para
// DESPUÉS de la 1.0 (decisión del dueño del producto, 2026-07-27). Reemplaza
// una maqueta de 558 líneas que simulaba un marketplace —"Zoom Meeting
// Integration", "AI Grading Assistant", 15.420 instalaciones, 4.8 estrellas,
// botones de Instalar— y que está en el sidebar: cualquier administrador
// entraba y creía que podía instalar algo. Dos de esos plugins inventados
// (pasarela de pagos, asistente de IA) son además áreas explícitamente NO
// aprobadas en CLAUDE.md.
//
// El catálogo de abajo NO es una promesa de entrega. Sale de
// docs/planning/plugins.md, que es una propuesta comercial, y cada tarjeta
// dice en qué estado real está. Los "requiere decisión aparte" y "fuera de
// alcance" no son adorno: recaudar en línea, la sincronización bidireccional
// con Google/Microsoft y la biometría están fuera del alcance aprobado.
// Antes de convertir cualquiera de estos en código hay que aprobar el alcance
// en CLAUDE.md, con fecha.
//
// Sin "use client" a propósito: no hay estado ni interacción, solo contenido.

type PluginStatus = "propuesto" | "decision-aparte" | "no-aprobado"

const STATUS_LABEL: Record<PluginStatus, string> = {
  propuesto: "En estudio",
  "decision-aparte": "Requiere decisión aparte",
  "no-aprobado": "Fuera de alcance hoy",
}

const STATUS_CLASS: Record<PluginStatus, string> = {
  propuesto: "border-blue-200 bg-blue-50 text-blue-700",
  "decision-aparte": "border-amber-200 bg-amber-50 text-amber-800",
  "no-aprobado": "border-neutral-200 bg-neutral-50 text-neutral-600",
}

type PluginGroup = {
  title: string
  icon: typeof Puzzle
  items: { name: string; description: string; status: PluginStatus; note?: string }[]
}

const CATALOG: PluginGroup[] = [
  {
    title: "Comunicación con las familias",
    icon: MessageSquare,
    items: [
      {
        name: "Notificaciones por WhatsApp",
        description:
          "Avisarle al acudiente por WhatsApp cuando su hijo falta, cuando hay una nota nueva o cuando vence una tarea.",
        status: "propuesto",
        note: "Se cobraría por volumen de mensajes, así que necesita proveedor autorizado y un modelo de recarga.",
      },
      {
        name: "SMS de emergencia",
        description:
          "Envío corto y masivo para familias sin datos móviles constantes, cuando el mensaje no puede esperar a que abran la app.",
        status: "propuesto",
      },
    ],
  },
  {
    title: "Cartera y facturación",
    icon: CreditCard,
    items: [
      {
        name: "Pasarela de pagos en línea",
        description: "Que la familia pague la pensión desde el portal en vez de ir al banco y traer el comprobante.",
        status: "decision-aparte",
        note:
          "Hoy Classia lleva cartera, no recauda: registra el pago que la familia hizo por fuera. Cobrar en línea arrastra alcance PCI, conciliación y reversiones — es una decisión de producto, no una tarea de desarrollo.",
      },
      {
        name: "Facturación electrónica",
        description:
          "Emitir la factura con validez legal al registrar el pago, con el proveedor tecnológico autorizado de cada país.",
        status: "decision-aparte",
        note: "Depende de lo anterior y de la normativa de facturación de cada país.",
      },
    ],
  },
  {
    title: "Sincronización con otras plataformas",
    icon: CalendarSync,
    items: [
      {
        name: "Google Workspace y Microsoft 365",
        description:
          "Crear los correos institucionales en masa y mantener grupos, tareas y calendario sincronizados con Classroom o Teams.",
        status: "no-aprobado",
        note:
          "La sincronización bidireccional de calendario quedó explícitamente fuera del core. El calendario de Classia sí se puede suscribir hoy en modo lectura desde Google, Outlook o Apple.",
      },
      {
        name: "Conector con Moodle",
        description: "Traer notas y tareas de un Moodle que el colegio ya usa, para consolidarlas en el boletín de Classia.",
        status: "propuesto",
      },
    ],
  },
  {
    title: "Portería y hardware",
    icon: QrCode,
    items: [
      {
        name: "Asistencia por carnet o QR",
        description: "Un tablero en la entrada: el estudiante pasa su carnet y queda marcada la asistencia del día.",
        status: "propuesto",
      },
      {
        name: "Lector biométrico",
        description: "Control de entrada y salida del personal con huella o RFID.",
        status: "no-aprobado",
        note: "La biometría está en la lista de áreas no aprobadas: son datos sensibles y es una decisión aparte.",
      },
    ],
  },
]

const YA_INCLUIDO = [
  "Mensajería interna y chat en tiempo real con las familias",
  "Calendario escolar con feed suscribible desde Google, Outlook o Apple (lectura)",
  "Notificaciones dentro de la plataforma y por correo",
  "Cartera: conceptos de cobro, facturas y registro de pagos",
  "Boletines, certificados y reportes",
]

export default function AdminPluginsPage() {
  return (
    <>
      <header className="border-b border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <Puzzle className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Plugins</h1>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                Después de la versión 1.0
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Todavía no hay nada que instalar, y esta pantalla no esconde un catálogo real: los
              plugins son trabajo posterior al lanzamiento. Acá está qué se está considerando y en qué
              estado va cada cosa, para que sepas con qué contar y con qué no.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />
            <div className="space-y-2 text-sm text-blue-900">
              <p className="font-semibold">Cómo van a funcionar cuando existan</p>
              <p>
                Classia no va a cargar código de terceros dentro de la plataforma, a diferencia de
                Moodle o WordPress. Un plugin acá es un módulo que ya viene compilado y que se activa
                para tu colegio, con las credenciales que tú configures. Es una decisión de seguridad:
                el código que corre sobre los datos de tus estudiantes es siempre el nuestro, revisado
                y desplegado por nosotros.
              </p>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Catálogo en estudio
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {CATALOG.map((group) => (
              <Card key={group.title} className="min-w-0">
                <CardHeader className="border-b border-border">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <group.icon className="h-4 w-4 text-muted-foreground" />
                    {group.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border p-0">
                  {group.items.map((item) => (
                    <div key={item.name} className="space-y-2 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-foreground">{item.name}</p>
                        <Badge variant="outline" className={STATUS_CLASS[item.status]}>
                          {STATUS_LABEL[item.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.note && (
                        <p className="flex gap-2 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{item.note}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-base">Esto ya viene incluido, sin plugin</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="mb-3 text-sm text-muted-foreground">
                Vale aclararlo porque son funciones que otros sistemas cobran aparte:
              </p>
              <ul className="space-y-2">
                {YA_INCLUIDO.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-base">¿Cuál te haría falta?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4 p-5">
              <p className="text-sm text-muted-foreground">
                El orden en que se construyan lo deciden los colegios que los pidan. Si alguno de
                estos te resolvería un problema concreto, cuéntanoslo por soporte y queda registrado.
              </p>
              <Button asChild className="gap-2">
                <Link href="/admin/soporte">
                  Escribir a soporte
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Ningún plugin de esta lista está activo ni recolectando datos hoy. Cuando alguno se
            habilite para tu colegio vas a tener que configurarlo explícitamente desde acá.
          </span>
        </p>
      </div>
    </>
  )
}
