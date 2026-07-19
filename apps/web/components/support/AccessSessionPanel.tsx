"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Clock, Loader2, LogIn, ShieldCheck, ShieldOff, ShieldQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"
import { impersonateTenant } from "@/lib/auth"

type AccessScope = "OPERATIVO" | "DATOS_PERSONALES"
type AccessSessionStatus = "SOLICITADO" | "CONCEDIDO" | "EXPIRADO" | "REVOCADO" | "EMERGENCIA"

type AccessSession = {
  id: string
  scope: AccessScope
  status: AccessSessionStatus
  reason: string
  requestedAt: string
  grantedAt: string | null
  expiresAt: string | null
  requestedBy: { id: string; firstName: string; lastName: string }
  approvedBy: { id: string; firstName: string; lastName: string } | null
}

const SCOPE_LABELS: Record<AccessScope, string> = {
  OPERATIVO: "Operativo (config, horarios, cursos)",
  DATOS_PERSONALES: "Datos personales (notas, asistencia, pagos...)",
}

const STATUS_BADGE: Record<AccessSessionStatus, { label: string; className: string }> = {
  SOLICITADO: { label: "Pendiente de aprobación", className: "bg-amber-100 text-amber-800" },
  CONCEDIDO: { label: "Concedido", className: "bg-emerald-100 text-emerald-800" },
  EMERGENCIA: { label: "Emergencia", className: "bg-red-100 text-red-800" },
  EXPIRADO: { label: "Expirado", className: "bg-slate-100 text-slate-600" },
  REVOCADO: { label: "Revocado", className: "bg-slate-100 text-slate-600" },
}

type Props = {
  ticketId: string
  tenantId: string
  currentUserId?: string
  isSupervisor: boolean
  isTicketActive: boolean
  onEnterTenant: () => void
}

export function AccessSessionPanel({ ticketId, tenantId, currentUserId, isSupervisor, isTicketActive, onEnterTenant }: Props) {
  const [sessions, setSessions] = useState<AccessSession[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showEmergencyForm, setShowEmergencyForm] = useState(false)
  const [scope, setScope] = useState<AccessScope>("OPERATIVO")
  const [reason, setReason] = useState("")
  const [enteringTenant, setEnteringTenant] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiFetch(`/access-sessions?ticketId=${ticketId}`, { silent: true })
      if (res.ok) setSessions(await res.json())
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const activeSession = sessions.find((s) => s.status === "CONCEDIDO" || s.status === "EMERGENCIA")
  const pendingSession = sessions.find((s) => s.status === "SOLICITADO")
  const isActiveMine = activeSession?.requestedBy.id === currentUserId

  async function submitRequest() {
    if (reason.trim().length < 10) {
      alert("Describe el motivo del acceso (mínimo 10 caracteres)")
      return
    }
    setBusy(true)
    try {
      const res = await apiFetch("/access-sessions", {
        method: "POST",
        body: JSON.stringify({ ticketId, scope, reason, durationMinutes: 240 }),
      })
      if (res.ok) {
        setShowRequestForm(false)
        setReason("")
        fetchSessions()
      } else {
        const body = await res.json().catch(() => ({}))
        alert(body.message || "No se pudo solicitar el acceso")
      }
    } finally {
      setBusy(false)
    }
  }

  async function respondTo(sessionId: string, action: "approve" | "deny") {
    setBusy(true)
    try {
      const path = `/access-sessions/${sessionId}/${action}`
      const res = await apiFetch(path, {
        method: "PATCH",
        body: action === "deny" ? JSON.stringify({ reason: "Denegado por el supervisor" }) : undefined,
      })
      if (res.ok) fetchSessions()
      else alert("No se pudo procesar la solicitud")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(sessionId: string) {
    setBusy(true)
    try {
      const res = await apiFetch(`/access-sessions/${sessionId}/revoke`, {
        method: "PATCH",
        body: JSON.stringify({ reason: "Revocado manualmente por el supervisor" }),
      })
      if (res.ok) fetchSessions()
    } finally {
      setBusy(false)
    }
  }

  async function submitEmergency() {
    if (reason.trim().length < 15) {
      alert("El acceso de emergencia exige una justificación detallada (mínimo 15 caracteres)")
      return
    }
    if (!confirm("El acceso de emergencia se concede sin aprobación previa y notifica al colegio de inmediato. ¿Continuar?")) return
    setBusy(true)
    try {
      const res = await apiFetch("/access-sessions/break-glass", {
        method: "POST",
        body: JSON.stringify({ ticketId, scope, reason, durationMinutes: 60 }),
      })
      if (res.ok) {
        setShowEmergencyForm(false)
        setReason("")
        fetchSessions()
      } else {
        const body = await res.json().catch(() => ({}))
        alert(body.message || "No se pudo conceder el acceso de emergencia")
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleEnterTenant() {
    setEnteringTenant(true)
    try {
      await impersonateTenant(tenantId, ticketId, window.location.pathname)
      onEnterTenant()
    } catch (e: any) {
      alert(e.message || "No se pudo entrar al colegio")
      setEnteringTenant(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <ShieldQuestion className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acceso al colegio</Label>
      </div>

      {activeSession && (
        <div className={`rounded-lg border p-3 ${activeSession.status === "EMERGENCIA" ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {activeSession.status === "EMERGENCIA" ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
              <Badge className={STATUS_BADGE[activeSession.status].className}>{STATUS_BADGE[activeSession.status].label}</Badge>
            </div>
            <span className="text-[11px] text-muted-foreground">{SCOPE_LABELS[activeSession.scope]}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {activeSession.requestedBy.firstName} {activeSession.requestedBy.lastName}
            {activeSession.expiresAt && (
              <> · expira {new Date(activeSession.expiresAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            {isActiveMine && (
              <Button size="sm" className="gap-2 flex-1" onClick={handleEnterTenant} disabled={enteringTenant || !isTicketActive}>
                <LogIn className="h-3.5 w-3.5" /> Entrar al colegio
              </Button>
            )}
            {isSupervisor && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => revoke(activeSession.id)} disabled={busy}>
                <ShieldOff className="h-3.5 w-3.5" /> Revocar
              </Button>
            )}
          </div>
        </div>
      )}

      {pendingSession && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <Badge className={STATUS_BADGE.SOLICITADO.className}>Pendiente de aprobación</Badge>
          </div>
          <p className="mt-2 text-xs text-foreground">{pendingSession.reason}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {pendingSession.requestedBy.firstName} {pendingSession.requestedBy.lastName} · {SCOPE_LABELS[pendingSession.scope]}
          </p>
          {isSupervisor && pendingSession.requestedBy.id !== currentUserId && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => respondTo(pendingSession.id, "approve")} disabled={busy}>
                Aprobar
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => respondTo(pendingSession.id, "deny")} disabled={busy}>
                Negar
              </Button>
            </div>
          )}
        </div>
      )}

      {!activeSession && !pendingSession && !showRequestForm && !showEmergencyForm && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isTicketActive ? "No hay acceso activo para este ticket." : "El ticket está cerrado; el acceso solo aplica a tickets activos."}
          </p>
          {isTicketActive && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setShowRequestForm(true)}>
                Solicitar acceso
              </Button>
              {isSupervisor && (
                <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowEmergencyForm(true)}>
                  <AlertTriangle className="h-3.5 w-3.5" /> Emergencia
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {(showRequestForm || showEmergencyForm) && (
        <div className={`space-y-3 rounded-lg border p-3 ${showEmergencyForm ? "border-red-200 bg-red-50" : "border-border bg-muted/30"}`}>
          {showEmergencyForm && (
            <p className="text-xs text-red-700">
              Se concede de inmediato sin aprobación del supervisor y notifica al colegio apenas se otorga.
            </p>
          )}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Alcance</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as AccessScope)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OPERATIVO">{SCOPE_LABELS.OPERATIVO}</SelectItem>
                <SelectItem value="DATOS_PERSONALES">{SCOPE_LABELS.DATOS_PERSONALES}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Motivo</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Para qué necesitas este acceso..."
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              variant={showEmergencyForm ? "destructive" : "default"}
              onClick={showEmergencyForm ? submitEmergency : submitRequest}
              disabled={busy}
            >
              {showEmergencyForm ? "Conceder de emergencia" : "Enviar solicitud"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowRequestForm(false)
                setShowEmergencyForm(false)
                setReason("")
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Historial ({sessions.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {s.requestedBy.firstName} {s.requestedBy.lastName} · {SCOPE_LABELS[s.scope]}
                </span>
                <Badge className={STATUS_BADGE[s.status].className}>{STATUS_BADGE[s.status].label}</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
