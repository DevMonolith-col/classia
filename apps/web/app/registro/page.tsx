"use client"

import Link from "next/link"
import { useState } from "react"
import { Building2, CheckCircle2, Loader2, Mail, MapPin, Phone, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"

// Solicitud de demo real, contra POST /demo-requests (público, con rate-limit).
//
// Reemplaza un asistente falso de tres pasos que elegía plan, pedía los datos del colegio y
// una CONTRASEÑA, y al final no llamaba a ninguna API: los datos se perdían y la persona
// quedaba esperando una cuenta que nadie iba a crear. El alta de colegio sigue siendo manual
// (POST /tenants exige permiso de administrador); esto es el paso previo, comercial.
//
// Acá no se elige plan ni se muestran precios a propósito: la cotización se arma adentro, en
// /superadmin/solicitudes, con el tamaño real del colegio. Un precio de lista en el formulario
// es una promesa que después hay que sostener.

// Debe reflejar DEMO_REQUEST_INTERESTS en demo-requests.schemas.ts (API): el backend valida
// contra esa lista y rechaza cualquier otro valor con 400.
const INTERESES = [
  { value: "CALIFICACIONES", label: "Notas y boletines" },
  { value: "ASISTENCIA", label: "Asistencia" },
  { value: "COMUNICACION", label: "Comunicación con familias" },
  { value: "CARTERA", label: "Cartera y facturación" },
  { value: "BOLETINES", label: "Informes académicos" },
  { value: "HORARIOS", label: "Horarios" },
  { value: "CERTIFICADOS", label: "Certificados" },
  { value: "OTRO", label: "Otra cosa" },
] as const

const CARGOS = ["Rector(a)", "Coordinador(a)", "Secretaría", "Administración", "Docente", "Otro"]

export default function RegistroPage() {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState("")

  const [schoolName, setSchoolName] = useState("")
  const [city, setCity] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactRole, setContactRole] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [studentCount, setStudentCount] = useState("")
  const [interests, setInterests] = useState<string[]>([])
  const [message, setMessage] = useState("")

  const toggleInterest = (value: string) => {
    setInterests((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setEnviando(true)

    try {
      const parsedStudentCount = Number.parseInt(studentCount, 10)
      const res = await apiFetch("/demo-requests", {
        method: "POST",
        // Sin sesión: es el sitio público. Sin `silent` el api-client mostraría además su
        // propio toast genérico encima del mensaje de esta pantalla.
        skipAuth: true,
        silent: true,
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || undefined,
          contactRole: contactRole || undefined,
          city: city.trim() || undefined,
          studentCount: Number.isFinite(parsedStudentCount) ? parsedStudentCount : undefined,
          interests,
          message: message.trim() || undefined,
          source: "registro",
        }),
      })

      if (res.status === 429) {
        setError("Recibimos varias solicitudes desde esta conexión. Espera un minuto e intenta de nuevo.")
        return
      }

      if (!res.ok) {
        setError("No pudimos enviar la solicitud. Revisa los datos e intenta de nuevo.")
        return
      }

      setEnviado(true)
    } catch {
      setError("No pudimos conectarnos. Verifica tu conexión e intenta de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Recibimos tu solicitud</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Te vamos a escribir a <span className="font-medium text-foreground">{contactEmail}</span>{" "}
                para coordinar la demostración y pasarte una propuesta con el tamaño de{" "}
                {schoolName || "tu colegio"}.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-secondary p-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Classia</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <h1 className="text-center text-2xl font-bold text-foreground">Solicita una demostración</h1>
            <p className="text-center text-sm text-muted-foreground">
              Cuéntanos de tu colegio y te preparamos una propuesta a la medida. Sin tarjeta, sin
              compromiso.
            </p>
          </CardHeader>

          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre del colegio" required>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      value={schoolName}
                      onChange={(event) => setSchoolName(event.target.value)}
                      placeholder="Colegio San Martín"
                      className="pl-10"
                      maxLength={160}
                    />
                  </div>
                </Field>

                <Field label="Ciudad">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="Bogotá, Colombia"
                      className="pl-10"
                      maxLength={80}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tu nombre" required>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="María Rodríguez"
                      className="pl-10"
                      maxLength={120}
                    />
                  </div>
                </Field>

                <Field label="Tu cargo">
                  <select
                    value={contactRole}
                    onChange={(event) => setContactRole(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona…</option>
                    {CARGOS.map((cargo) => (
                      <option key={cargo} value={cargo}>
                        {cargo}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Correo" required>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="rectoria@colegio.edu.co"
                      className="pl-10"
                      maxLength={160}
                    />
                  </div>
                </Field>

                <Field label="Teléfono o WhatsApp">
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+57 300 000 0000"
                      className="pl-10"
                      maxLength={40}
                    />
                  </div>
                </Field>
              </div>

              <Field
                label="¿Cuántos estudiantes tiene?"
                hint="Es lo que más define la propuesta. Un aproximado sirve."
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20000}
                  value={studentCount}
                  onChange={(event) => setStudentCount(event.target.value)}
                  placeholder="450"
                  className="sm:max-w-[200px]"
                />
              </Field>

              <Field label="¿Qué necesitas resolver?" hint="Puedes marcar varias." group>
                <div className="flex flex-wrap gap-2">
                  {INTERESES.map((interes) => {
                    const active = interests.includes(interes.value)
                    return (
                      <button
                        key={interes.value}
                        type="button"
                        onClick={() => toggleInterest(interes.value)}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                        }`}
                      >
                        {interes.label}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <Field label="Algo más que debamos saber">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Hoy llevamos las notas en Excel y queremos que las familias vean el boletín en línea."
                  rows={4}
                  maxLength={2000}
                />
              </Field>

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full gap-2" disabled={enviando}>
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                {enviando ? "Enviando…" : "Solicitar demostración"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Usamos estos datos solo para contactarte sobre Classia.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Tu colegio ya usa Classia?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

// `group`: para un conjunto de controles (los chips de intereses) en vez de un solo campo.
// Envolver botones en un <label> haría que cada clic dispare además el comportamiento del
// label sobre el primer control que encuentre — se rompe justo el que quiere marcar.
function Field({
  label,
  required,
  hint,
  group,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  group?: boolean
  children: React.ReactNode
}) {
  const Wrapper = group ? "div" : "label"

  return (
    <Wrapper className="block" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="mb-2 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </Wrapper>
  )
}
