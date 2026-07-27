"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  Calculator,
  Inbox,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Users,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Bandeja comercial: las solicitudes que llegan de /registro (POST público) y el seguimiento
// hasta cotizarlas. Solo SUPER_ADMIN — los permisos DEMO_REQUESTS_* no se le dieron al staff
// de soporte, que no tiene por qué ver precios ni datos de contacto de prospectos.

type DemoRequestStatus = "NEW" | "CONTACTED" | "QUOTED" | "WON" | "LOST"

type DemoRequest = {
  id: string
  schoolName: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  contactRole: string | null
  city: string | null
  studentCount: number | null
  interests: string[]
  message: string | null
  source: string | null
  status: DemoRequestStatus
  quotedPlan: string | null
  quotedAmount: number | null
  quotedCurrency: string | null
  quotedAt: string | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
  handledBy: { id: string; firstName: string; lastName: string; email: string } | null
}

const STATUS_ORDER: DemoRequestStatus[] = ["NEW", "CONTACTED", "QUOTED", "WON", "LOST"]

const STATUS_LABEL: Record<DemoRequestStatus, string> = {
  NEW: "Nueva",
  CONTACTED: "Contactada",
  QUOTED: "Cotizada",
  WON: "Ganada",
  LOST: "Perdida",
}

const STATUS_CLASS: Record<DemoRequestStatus, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-700",
  CONTACTED: "border-amber-200 bg-amber-50 text-amber-800",
  QUOTED: "border-violet-200 bg-violet-50 text-violet-700",
  WON: "border-green-200 bg-green-50 text-green-700",
  LOST: "border-neutral-200 bg-neutral-50 text-neutral-500",
}

// Debe reflejar DEMO_REQUEST_INTERESTS en demo-requests.schemas.ts (API).
const INTEREST_LABEL: Record<string, string> = {
  CALIFICACIONES: "Notas y boletines",
  ASISTENCIA: "Asistencia",
  COMUNICACION: "Comunicación con familias",
  CARTERA: "Cartera y facturación",
  BOLETINES: "Informes académicos",
  HORARIOS: "Horarios",
  CERTIFICADOS: "Certificados",
  OTRO: "Otra cosa",
}

// Los planes del sitio público. **Debe reflejar components/landing/pricing.tsx**: si acá dice
// otra cifra que la que el colegio vio publicada, la primera llamada empieza con una
// corrección. Es una sugerencia para no hacer la cuenta a mano, no un precio final: el monto
// que se guarda es el que se escriba abajo.
const PLAN_TIERS = [
  { maxStudents: 200, plan: "Básico", amount: 299, currency: "USD" },
  { maxStudents: 1000, plan: "Profesional", amount: 599, currency: "USD" },
] as const

function suggestPlan(studentCount: number | null) {
  if (studentCount === null) return null
  const tier = PLAN_TIERS.find((candidate) => studentCount <= candidate.maxStudents)
  if (!tier) {
    // Por encima de 1.000 estudiantes el sitio no publica precio ("Personalizado"), así que
    // acá tampoco se inventa uno.
    return { plan: "Empresarial", amount: null, currency: "USD" }
  }
  return { plan: tier.plan, amount: tier.amount, currency: tier.currency }
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function daysWaiting(createdAt: string) {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return null
  return Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000))
}

export default function SuperAdminDemoRequestsPage() {
  const [requests, setRequests] = useState<DemoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState<DemoRequestStatus | "TODAS">("TODAS")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/demo-requests", { silent: true })
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "No tienes permiso para ver las solicitudes."
            : "No se pudo cargar la bandeja de solicitudes.",
        )
      }
      const data = (await res.json()) as DemoRequest[]
      setRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const base: Record<string, number> = { TODAS: requests.length }
    for (const status of STATUS_ORDER) {
      base[status] = requests.filter((request) => request.status === status).length
    }
    return base
  }, [requests])

  const visible = useMemo(
    () => (statusFilter === "TODAS" ? requests : requests.filter((r) => r.status === statusFilter)),
    [requests, statusFilter],
  )

  const selected = useMemo(
    () => visible.find((request) => request.id === selectedId) ?? visible[0] ?? null,
    [visible, selectedId],
  )

  function handleSaved(saved: DemoRequest) {
    setRequests((current) => current.map((item) => (item.id === saved.id ? saved : item)))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Operacion global
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Solicitudes de demo
            </h1>
          </div>
          <Button variant="outline" size="sm" className="gap-2 sm:w-fit" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["TODAS", ...STATUS_ORDER] as const).map((value) => {
            const active = statusFilter === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {value === "TODAS" ? "Todas" : STATUS_LABEL[value]}
                <span className="ml-1.5 tabular-nums opacity-70">{counts[value] ?? 0}</span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg bg-secondary" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                {requests.length === 0 ? "Todavía no llegó ninguna solicitud" : "Nada con ese filtro"}
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {requests.length === 0
                  ? "Cuando alguien complete el formulario de /registro en el sitio público, va a aparecer acá."
                  : "Cambia el estado seleccionado para ver el resto."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="space-y-2 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
              {visible.map((request) => {
                const active = selected?.id === request.id
                const waiting = daysWaiting(request.createdAt)
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedId(request.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-foreground">{request.schoolName}</p>
                      <Badge variant="outline" className={STATUS_CLASS[request.status]}>
                        {STATUS_LABEL[request.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {request.contactName}
                      {request.city ? ` · ${request.city}` : ""}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {request.studentCount ? `${request.studentCount} estudiantes` : "sin dato"}
                      </span>
                      {waiting !== null && request.status === "NEW" && (
                        <span className={waiting >= 2 ? "font-medium text-amber-700" : ""}>
                          {waiting === 0 ? "hoy" : `hace ${waiting} d`}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {selected && <RequestDetail key={selected.id} request={selected} onSaved={handleSaved} />}
          </div>
        )}
      </div>
    </div>
  )
}

function RequestDetail({
  request,
  onSaved,
}: {
  request: DemoRequest
  onSaved: (saved: DemoRequest) => void
}) {
  const [status, setStatus] = useState<DemoRequestStatus>(request.status)
  const [quotedPlan, setQuotedPlan] = useState(request.quotedPlan ?? "")
  const [quotedAmount, setQuotedAmount] = useState(
    request.quotedAmount === null ? "" : String(request.quotedAmount),
  )
  const [quotedCurrency, setQuotedCurrency] = useState(request.quotedCurrency ?? "USD")
  const [internalNotes, setInternalNotes] = useState(request.internalNotes ?? "")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const suggestion = suggestPlan(request.studentCount)

  const applySuggestion = () => {
    if (!suggestion) return
    setQuotedPlan(suggestion.plan)
    setQuotedAmount(suggestion.amount === null ? "" : String(suggestion.amount))
    setQuotedCurrency(suggestion.currency)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    try {
      const parsedAmount = quotedAmount.trim() === "" ? null : Number(quotedAmount)
      if (parsedAmount !== null && !Number.isFinite(parsedAmount)) {
        setSaveError("El monto no es un número válido.")
        return
      }

      const res = await apiFetch(`/demo-requests/${request.id}`, {
        method: "PATCH",
        silent: true,
        body: JSON.stringify({
          status,
          quotedPlan: quotedPlan.trim() || null,
          quotedAmount: parsedAmount,
          quotedCurrency: quotedCurrency.trim() ? quotedCurrency.trim().toUpperCase() : null,
          internalNotes: internalNotes.trim() || null,
        }),
      })

      if (!res.ok) {
        setSaveError(
          res.status === 403
            ? "No tienes permiso para actualizar solicitudes."
            : "No se pudo guardar. Revisa los datos e intenta de nuevo.",
        )
        return
      }

      onSaved((await res.json()) as DemoRequest)
    } catch {
      setSaveError("No se pudo conectar con el servidor.")
    } finally {
      setSaving(false)
    }
  }

  // mailto abre el cliente de correo con el borrador listo; no manda nada por su cuenta.
  const mailtoHref = `mailto:${request.contactEmail}?subject=${encodeURIComponent(
    `Classia — propuesta para ${request.schoolName}`,
  )}&body=${encodeURIComponent(`Hola ${request.contactName.split(" ")[0] ?? ""},\n\n`)}`

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-3 border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{request.schoolName}</span>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Llegó el {formatDate(request.createdAt)}
              {request.source ? ` · desde ${request.source}` : ""}
            </p>
          </div>
          <Badge variant="outline" className={STATUS_CLASS[request.status]}>
            {STATUS_LABEL[request.status]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <DetailRow icon={Mail} label="Contacto">
            <p className="font-medium text-foreground">
              {request.contactName}
              {request.contactRole ? ` · ${request.contactRole}` : ""}
            </p>
            <a href={mailtoHref} className="text-primary hover:underline">
              {request.contactEmail}
            </a>
          </DetailRow>

          <DetailRow icon={Phone} label="Teléfono">
            {request.contactPhone ? (
              <a href={`tel:${request.contactPhone}`} className="text-primary hover:underline">
                {request.contactPhone}
              </a>
            ) : (
              <span className="text-muted-foreground">No lo dejó</span>
            )}
          </DetailRow>

          <DetailRow icon={MapPin} label="Ciudad">
            {request.city ?? <span className="text-muted-foreground">Sin dato</span>}
          </DetailRow>

          <DetailRow icon={Users} label="Tamaño">
            {request.studentCount ? (
              `${request.studentCount} estudiantes`
            ) : (
              <span className="text-muted-foreground">Sin dato — preguntarlo en la llamada</span>
            )}
          </DetailRow>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground">Qué necesita</h3>
          {request.interests.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {request.interests.map((interest) => (
                <Badge key={interest} variant="outline">
                  {INTEREST_LABEL[interest] ?? interest}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No marcó nada en el formulario.</p>
          )}
          {request.message && (
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm text-foreground">
              {request.message}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Cotización</h3>
            {suggestion && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={applySuggestion}>
                <Calculator className="h-3.5 w-3.5" />
                Sugerencia: {suggestion.plan}
                {suggestion.amount !== null ? ` · ${suggestion.currency} ${suggestion.amount}/mes` : " · a medida"}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Plan</span>
              <Input value={quotedPlan} onChange={(e) => setQuotedPlan(e.target.value)} placeholder="Profesional" maxLength={80} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Monto mensual</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={quotedAmount}
                onChange={(e) => setQuotedAmount(e.target.value)}
                placeholder="599"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Moneda</span>
              <select
                value={quotedCurrency}
                onChange={(e) => setQuotedCurrency(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="USD">USD</option>
                <option value="COP">COP</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Queda anotado para no buscarlo en el correo después. Por Classia no pasa dinero: el
            cobro se sigue haciendo por fuera.
          </p>
        </section>

        <section className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foreground">Notas internas</span>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Pidió migrar las notas del año pasado. Vuelve a llamar el lunes."
            />
          </label>
          <p className="text-xs text-muted-foreground">Solo las ve el equipo, nunca el colegio.</p>
        </section>

        {saveError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {saveError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Estado</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DemoRequestStatus)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {STATUS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={mailtoHref}>
                <Mail className="h-3.5 w-3.5" />
                Responder
              </a>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {request.handledBy
            ? `Última actualización por ${request.handledBy.firstName} ${request.handledBy.lastName}, ${formatDate(request.updatedAt)}.`
            : "Todavía no la ha tocado nadie."}
          {request.quotedAt ? ` Cotizada el ${formatDate(request.quotedAt)}.` : ""}
        </p>
      </CardContent>
    </Card>
  )
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5 break-words text-foreground">{children}</div>
      </div>
    </div>
  )
}
