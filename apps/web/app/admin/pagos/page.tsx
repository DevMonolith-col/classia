"use client"

import { useCallback, useEffect, useState } from "react"
import { Wallet, Plus, Receipt, Ban, DollarSign } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GroupCombobox, type GroupOption } from "@/components/admin/group-combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED"
type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER"

type AcademicYear = { id: string; name: string; isActive: boolean }

type FeeConcept = {
  id: string
  name: string
  amount: string
  dueDate: string
  academicYear: { name: string }
  group: { grade: string; section: string } | null
  _count: { invoices: number }
}

type Invoice = {
  id: string
  concept: string
  amount: string
  dueDate: string
  status: InvoiceStatus
  student: { firstName: string; lastName: string; group: { grade: string; section: string } | null }
  payments: { amount: string }[]
}

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PARTIAL: { label: "Pago parcial", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PAID: { label: "Pagada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Cancelada", className: "bg-slate-100 text-slate-600 border-slate-200" },
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  OTHER: "Otro",
}

function formatCOP(value: string) {
  const n = Number(value)
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
}

export default function PagosPage() {
  const [feeConcepts, setFeeConcepts] = useState<FeeConcept[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("")
  const [groupFilter, setGroupFilter] = useState<string | null>(null)

  const [conceptOpen, setConceptOpen] = useState(false)
  const [creatingConcept, setCreatingConcept] = useState(false)
  const [conceptForm, setConceptForm] = useState({ name: "", description: "", academicYearId: "", groupId: null as string | null, amount: "", dueDate: "" })

  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "CASH" as PaymentMethod, reference: "" })
  const [recordingPayment, setRecordingPayment] = useState(false)

  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null)

  const loadInvoices = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    if (groupFilter) params.set("groupId", groupFilter)
    const res = await apiFetch(`/invoices?${params.toString()}`, { silent: true })
    if (res.ok) setInvoices(await res.json())
  }, [statusFilter, groupFilter])

  const loadConcepts = useCallback(async () => {
    const res = await apiFetch("/fee-concepts", { silent: true })
    if (res.ok) setFeeConcepts(await res.json())
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadConcepts(), loadInvoices()]).finally(() => setLoading(false))
    apiFetch("/academic-years", { silent: true }).then(async (res) => {
      if (!res.ok) return
      const years = (await res.json()) as AcademicYear[]
      setAcademicYears(years)
      const active = years.find((y) => y.isActive)
      if (active) setConceptForm((f) => ({ ...f, academicYearId: active.id }))
    })
    apiFetch("/groups", { silent: true }).then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { id: string; name: string; grade: string; section: string }[]
      setGroups(data.map((g) => ({ id: g.id, name: g.name, grade: g.grade, section: g.section })))
    })
  }, [loadConcepts, loadInvoices])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const createConcept = async () => {
    if (!conceptForm.name.trim() || !conceptForm.academicYearId || !conceptForm.amount || !conceptForm.dueDate) return
    setCreatingConcept(true)
    try {
      const res = await apiFetch("/fee-concepts", {
        method: "POST",
        body: JSON.stringify({
          name: conceptForm.name.trim(),
          description: conceptForm.description.trim() || undefined,
          academicYearId: conceptForm.academicYearId,
          groupId: conceptForm.groupId ?? undefined,
          amount: Number(conceptForm.amount),
          dueDate: new Date(conceptForm.dueDate).toISOString(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo crear el concepto de cobro")
      }
      setConceptOpen(false)
      setConceptForm((f) => ({ ...f, name: "", description: "", groupId: null, amount: "", dueDate: "" }))
      loadConcepts()
      loadInvoices()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setCreatingConcept(false)
    }
  }

  const recordPayment = async () => {
    if (!paymentTarget || !paymentForm.amount) return
    setRecordingPayment(true)
    try {
      const res = await apiFetch(`/invoices/${paymentTarget.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          reference: paymentForm.reference.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo registrar el pago")
      }
      setPaymentTarget(null)
      setPaymentForm({ amount: "", method: "CASH", reference: "" })
      loadInvoices()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setRecordingPayment(false)
    }
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    const res = await apiFetch(`/invoices/${cancelTarget.id}`, { method: "DELETE" })
    setCancelTarget(null)
    if (res.ok) loadInvoices()
  }

  const clearFilters = () => {
    setStatusFilter("")
    setGroupFilter(null)
  }

  const balanceOf = (invoice: Invoice) => {
    const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    return Number(invoice.amount) - paid
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Pagos
          </h1>
          <p className="text-sm text-muted-foreground">Conceptos de cobro, facturas y pagos del colegio.</p>
        </div>
        <Dialog open={conceptOpen} onOpenChange={setConceptOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nuevo concepto de cobro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo concepto de cobro</DialogTitle>
              <DialogDescription>Se genera una factura para cada estudiante activo del alcance elegido.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={conceptForm.name} onChange={(e) => setConceptForm((f) => ({ ...f, name: e.target.value }))} placeholder="Matrícula 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción (opcional)</Label>
                <Textarea value={conceptForm.description} onChange={(e) => setConceptForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Año académico</Label>
                  <Select value={conceptForm.academicYearId} onValueChange={(v) => setConceptForm((f) => ({ ...f, academicYearId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? " (vigente)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Monto (COP)</Label>
                  <Input type="number" min="0" value={conceptForm.amount} onChange={(e) => setConceptForm((f) => ({ ...f, amount: e.target.value }))} placeholder="350000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Alcance</Label>
                <GroupCombobox groups={groups} value={conceptForm.groupId} onChange={(v) => setConceptForm((f) => ({ ...f, groupId: v }))} allowAllLabel="Todo el colegio" />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha límite de pago</Label>
                <Input type="date" value={conceptForm.dueDate} onChange={(e) => setConceptForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createConcept} disabled={creatingConcept}>{creatingConcept ? "Creando..." : "Crear y facturar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conceptos de cobro</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : feeConcepts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Todavía no hay conceptos de cobro.</div>
          ) : (
            <div className="divide-y divide-border">
              {feeConcepts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.academicYear.name} · {c.group ? `${c.group.grade}${c.group.section}` : "Todo el colegio"} · {c._count.invoices} facturas
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatCOP(c.amount)}</p>
                    <p className="text-xs text-muted-foreground">Vence {new Date(c.dueDate).toLocaleDateString("es-CO")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Facturas</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Select value={statusFilter || "ALL"} onValueChange={(v) => setStatusFilter(v === "ALL" ? "" : (v as InvoiceStatus))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="PARTIAL">Pago parcial</SelectItem>
                <SelectItem value="PAID">Pagada</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-56">
              <GroupCombobox groups={groups} value={groupFilter} onChange={setGroupFilter} />
            </div>
            {(statusFilter || groupFilter) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Eliminar filtros</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay facturas para este filtro.</div>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((invoice) => {
                const status = STATUS_BADGE[invoice.status]
                const balance = balanceOf(invoice)
                return (
                  <div key={invoice.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{invoice.student.firstName} {invoice.student.lastName}</span>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invoice.concept} · {invoice.student.group ? `${invoice.student.group.grade}${invoice.student.group.section}` : "Sin grupo"} · vence {new Date(invoice.dueDate).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">{formatCOP(invoice.amount)}</p>
                        {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                          <p className="text-xs text-muted-foreground">Saldo {formatCOP(String(balance))}</p>
                        )}
                      </div>
                      {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                        <Button variant="outline" size="sm" onClick={() => { setPaymentTarget(invoice); setPaymentForm({ amount: String(balance), method: "CASH", reference: "" }) }} className="gap-1.5">
                          <DollarSign className="h-3.5 w-3.5" /> Registrar pago
                        </Button>
                      )}
                      {invoice.payments.length === 0 && invoice.status !== "CANCELLED" && (
                        <Button variant="ghost" size="icon" onClick={() => setCancelTarget(invoice)} title="Cancelar factura">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(paymentTarget)} onOpenChange={(open) => !open && setPaymentTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {paymentTarget?.student.firstName} {paymentTarget?.student.lastName} · {paymentTarget?.concept}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto (COP)</Label>
                <Input type="number" min="0" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm((f) => ({ ...f, method: v as PaymentMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Referencia (opcional)</Label>
              <Input value={paymentForm.reference} onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))} placeholder="N° de comprobante" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={recordPayment} disabled={recordingPayment}>{recordingPayment ? "Registrando..." : "Registrar pago"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta factura?</AlertDialogTitle>
            <AlertDialogDescription>
              La factura de {cancelTarget?.concept} para {cancelTarget?.student.firstName} {cancelTarget?.student.lastName} quedará cancelada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Cancelar factura</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
