"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, CheckCircle2, Info, Receipt, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"

/**
 * Estado de cuenta de la familia.
 *
 * Esto es **cartera, no recaudo**: la pantalla muestra qué se debe y cuándo vence, y ahí
 * termina. No lleva botón de pagar ni enlace a pasarela — recaudar en línea no está aprobado
 * (CLAUDE.md, "Alcance del producto"), y el mismo límite está anotado en
 * `CalendarAggregationService#invoiceItems`. Por Classia no pasa dinero: los pagos se
 * registran a mano cuando el colegio los confirma.
 */

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED"
type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER"

interface Student {
  id: string
  firstName: string
  lastName: string
  group: { name: string } | null
}

interface Payment {
  id: string
  amount: string
  method: PaymentMethod
  paidAt: string
  reference: string | null
}

/** Lo que devuelve `GET /students/:studentId/balance` — facturas crudas, sin totales. */
interface Invoice {
  id: string
  concept: string
  amount: string
  dueDate: string
  status: InvoiceStatus
  payments: Payment[]
}

interface StudentAccount {
  student: Student
  invoices: Invoice[]
  owedCents: number
  overdueCents: number
  paidCents: number
}

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PARTIAL: { label: "Pago parcial", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PAID: { label: "Pagada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Anulada", className: "bg-slate-100 text-slate-600 border-slate-200" },
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  OTHER: "Otro",
}

/**
 * Mismo criterio que `CalendarAggregationService#isPendingInvoice` (calendar-aggregation.service.ts).
 * Si los dos se separan, el calendario y esta pantalla le dicen cosas distintas a la misma
 * familia sobre la misma factura — así que cualquier cambio va en los dos lados.
 */
function isPendingInvoice(status: InvoiceStatus): boolean {
  return status === "PENDING" || status === "PARTIAL"
}

/**
 * Los `Decimal` de Prisma viajan como string por JSON. Se suma en centavos enteros para que
 * 370000.10 + 370000.20 no arrastre el error de coma flotante en un total de dinero.
 */
function toCents(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function formatCOP(cents: number): string {
  return (cents / 100).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  })
}

/**
 * `dueDate` es una fecha sin hora guardada a medianoche UTC. Formatearla en hora local la
 * corre un día hacia atrás en Colombia (UTC-5), así que se lee en UTC — el mismo idioma que
 * ya usan las pantallas de asistencia.
 */
function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** Día UTC como número comparable (20260814), para no comparar instantes con husos distintos. */
function utcDayStamp(date: Date): number {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
}

/**
 * Vencida solo si el día de vencimiento ya pasó; el mismo día se muestra como "vence hoy".
 * El sesgo es deliberado: en las horas de la noche colombiana el día UTC ya avanzó, así que
 * como mucho esto avisa "vence hoy" unas horas antes — nunca al revés. Decirle a una familia
 * que está en mora cuando todavía no lo está es el error caro.
 */
function isOverdue(invoice: Invoice, todayStamp: number): boolean {
  return isPendingInvoice(invoice.status) && utcDayStamp(new Date(invoice.dueDate)) < todayStamp
}

function paidCentsOf(invoice: Invoice): number {
  return invoice.payments.reduce((sum, p) => sum + toCents(p.amount), 0)
}

/** Saldo de una factura, con piso en cero: un sobrepago no debe restar de lo que se debe. */
function balanceCentsOf(invoice: Invoice): number {
  return Math.max(0, toCents(invoice.amount) - paidCentsOf(invoice))
}

/**
 * Las facturas anuladas no entran en ningún total: el colegio ya dijo que no se cobran.
 * Se siguen listando, en gris, porque es el estado de cuenta de la familia y ocultar una fila
 * que la institución tocó es peor que mostrarla.
 */
function summarize(student: Student, invoices: Invoice[], todayStamp: number): StudentAccount {
  const live = invoices.filter((i) => i.status !== "CANCELLED")

  return {
    student,
    invoices,
    owedCents: live.filter((i) => isPendingInvoice(i.status)).reduce((s, i) => s + balanceCentsOf(i), 0),
    overdueCents: live.filter((i) => isOverdue(i, todayStamp)).reduce((s, i) => s + balanceCentsOf(i), 0),
    paidCents: live.reduce((s, i) => s + paidCentsOf(i), 0),
  }
}

/** Pendientes primero y por vencimiento más próximo; después el histórico, lo más reciente arriba. */
function sortForDisplay(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => {
    const aPending = isPendingInvoice(a.status)
    const bPending = isPendingInvoice(b.status)
    if (aPending !== bPending) return aPending ? -1 : 1
    const aTime = new Date(a.dueDate).getTime()
    const bTime = new Date(b.dueDate).getTime()
    return aPending ? aTime - bTime : bTime - aTime
  })
}

export default function PagosFamiliaPage() {
  const [accounts, setAccounts] = useState<StudentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const studentsRes = await apiFetch("/students/mine", { silent: true })
      if (!studentsRes.ok) throw new Error("No se pudieron cargar los estudiantes vinculados.")
      const students = (await studentsRes.json()) as Student[]

      if (students.length === 0) {
        setAccounts([])
        return
      }

      // Una consulta por hijo, igual que `CalendarAggregationService#invoiceItems`: es un N+1
      // acotado (son uno o dos) y se elige a propósito, porque cada llamada vuelve a pasar por
      // el chequeo de pertenencia del backend en vez de confiar en una lista armada acá.
      const balances = await Promise.all(
        students.map(async (student) => {
          const res = await apiFetch(`/students/${student.id}/balance`, { silent: true })
          if (!res.ok) throw new Error(`No se pudo cargar el estado de cuenta de ${student.firstName}.`)
          return { student, invoices: (await res.json()) as Invoice[] }
        }),
      )

      const todayStamp = utcDayStamp(new Date())
      setAccounts(balances.map(({ student, invoices }) => summarize(student, invoices, todayStamp)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el estado de cuenta.")
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(
    () => ({
      owed: accounts.reduce((s, a) => s + a.owedCents, 0),
      overdue: accounts.reduce((s, a) => s + a.overdueCents, 0),
      paid: accounts.reduce((s, a) => s + a.paidCents, 0),
    }),
    [accounts],
  )

  const hasInvoices = accounts.some((a) => a.invoices.length > 0)
  const todayStamp = utcDayStamp(new Date())

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Estado de cuenta</h1>
        <p className="mt-1 text-muted-foreground">
          Lo que el colegio tiene registrado a la fecha
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-lg bg-secondary" />
          <div className="h-48 animate-pulse rounded-lg bg-secondary" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No tienes estudiantes vinculados.</p>
        </div>
      ) : !hasInvoices ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Receipt className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            El colegio todavía no ha registrado facturas para tus estudiantes.
          </p>
        </div>
      ) : (
        <>
          {/* Totales consolidados de la familia: la deuda se paga por hogar, no por hijo. */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<Wallet className="h-5 w-5" />}
              label="Debes"
              value={formatCOP(totals.owed)}
              tone={totals.owed > 0 ? "amber" : "emerald"}
            />
            <SummaryCard
              icon={<CalendarClock className="h-5 w-5" />}
              label="Vencido"
              value={formatCOP(totals.overdue)}
              tone={totals.overdue > 0 ? "red" : "muted"}
              hint={totals.overdue > 0 ? "Incluido en lo que debes" : undefined}
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Pagado"
              value={formatCOP(totals.paid)}
              tone="muted"
              hint="Total registrado por el colegio"
            />
          </div>

          {totals.owed === 0 && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Estás al día. No hay facturas pendientes.</p>
            </div>
          )}

          <div className="space-y-6">
            {accounts.map((account) => (
              <StudentAccountCard key={account.student.id} account={account} todayStamp={todayStamp} />
            ))}
          </div>

          {/* Cierra la expectativa que abre toda pantalla de cartera ("¿y dónde pago?") sin
              cruzar a recaudo: no hay botón porque no hay pasarela, y no la va a haber acá. */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Los pagos se realizan directamente con el colegio. Quedan reflejados en esta pantalla
              una vez la institución los registra.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: "amber" | "red" | "emerald" | "muted"
  hint?: string
}) {
  const toneClass = {
    amber: "text-amber-600",
    red: "text-red-600",
    emerald: "text-emerald-600",
    muted: "text-muted-foreground",
  }[tone]

  return (
    <Card>
      <CardContent className="p-4">
        <div className={`mb-2 flex items-center gap-2 text-sm font-medium ${toneClass}`}>
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function StudentAccountCard({ account, todayStamp }: { account: StudentAccount; todayStamp: number }) {
  const { student } = account
  const invoices = sortForDisplay(account.invoices)

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">
              {student.firstName} {student.lastName}
            </p>
            {student.group && <p className="text-xs text-muted-foreground">{student.group.name}</p>}
          </div>
          <p className={`text-sm font-semibold ${account.owedCents > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {account.owedCents > 0 ? `Debe ${formatCOP(account.owedCents)}` : "Al día"}
          </p>
        </div>

        {invoices.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin facturas registradas.</p>
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} todayStamp={todayStamp} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function InvoiceRow({ invoice, todayStamp }: { invoice: Invoice; todayStamp: number }) {
  const badge = STATUS_BADGE[invoice.status]
  const cancelled = invoice.status === "CANCELLED"
  const overdue = isOverdue(invoice, todayStamp)
  const dueStamp = utcDayStamp(new Date(invoice.dueDate))
  const dueToday = isPendingInvoice(invoice.status) && dueStamp === todayStamp
  const paid = paidCentsOf(invoice)
  const balance = balanceCentsOf(invoice)

  return (
    <li className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${cancelled ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-medium text-foreground ${cancelled ? "line-through" : ""}`}>{invoice.concept}</p>
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
          {overdue && (
            <Badge variant="outline" className="border-red-200 bg-red-100 text-red-700">
              Vencida
            </Badge>
          )}
        </div>
        <p className={`mt-1 text-xs ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
          {/* Una factura ya saldada o anulada no "vence": su fecha es historia, y el presente
              ("vence el 5 de julio" leído en agosto) se lee como un error de la plataforma. */}
          {cancelled
            ? "Anulada · "
            : invoice.status === "PAID"
              ? "Vencimiento: "
              : dueToday
                ? "Vence hoy · "
                : overdue
                  ? "Venció el "
                  : "Vence el "}
          {formatDueDate(invoice.dueDate)}
        </p>
        {invoice.payments.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {invoice.payments.map((payment) => (
              <li key={payment.id} className="text-xs text-muted-foreground">
                Abono de {formatCOP(toCents(payment.amount))} · {METHOD_LABELS[payment.method]} ·{" "}
                {formatDueDate(payment.paidAt)}
                {payment.reference && ` · Ref. ${payment.reference}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 text-left sm:text-right">
        <p className={`font-semibold text-foreground ${cancelled ? "line-through" : ""}`}>
          {formatCOP(toCents(invoice.amount))}
        </p>
        {!cancelled && paid > 0 && balance > 0 && (
          <p className="text-xs text-muted-foreground">Saldo {formatCOP(balance)}</p>
        )}
      </div>
    </li>
  )
}
