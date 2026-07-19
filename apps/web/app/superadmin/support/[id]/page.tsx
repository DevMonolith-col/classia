"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Clock, CheckCircle2, XCircle, AlertTriangle, User, Building2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import { getAccessToken, decodeJwt } from "@/lib/auth"
import { SupportChatThread, type StatusBadgeInfo } from "@/components/support/SupportChatThread"
import { AccessSessionPanel } from "@/components/support/AccessSessionPanel"

const statusConfig: Record<string, StatusBadgeInfo> = {
  OPEN: { label: "Abierto", colorClass: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", colorClass: "bg-amber-100 text-amber-800", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Esperando cliente", colorClass: "bg-purple-100 text-purple-800", icon: User },
  RESOLVED: { label: "Resuelto", colorClass: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", colorClass: "bg-slate-100 text-slate-800", icon: XCircle },
}

const priorityConfig: Record<string, { label: string, color: string }> = {
  LOW: { label: "Baja", color: "text-slate-500" },
  MEDIUM: { label: "Media", color: "text-blue-500" },
  HIGH: { label: "Alta", color: "text-amber-500" },
  CRITICAL: { label: "Crítica", color: "text-red-500 font-bold" },
}

const SUPPORT_TEAM_ROLES = ["SUPER_ADMIN", "SUPPORT_SUPERVISOR", "SUPPORT_AGENT"]

export default function SuperAdminTicketDetail() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const jwt = decodeJwt(getAccessToken() || "")
  const currentUser = jwt?.sub
  const isSupervisor = jwt?.role === "SUPER_ADMIN" || jwt?.role === "SUPPORT_SUPERVISOR"
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [agents, setAgents] = useState<any[]>([])
  const [assigning, setAssigning] = useState(false)

  const fetchTicketAndAgents = useCallback(async () => {
    try {
      const [ticketRes, agentsRes] = await Promise.all([
        apiFetch(`/support/tickets/${id}`),
        apiFetch(`/support/agents`)
      ])
      if (!ticketRes.ok) throw new Error("No se pudo cargar el ticket")
      setTicket(await ticketRes.json())
      if (agentsRes.ok) {
        setAgents(await agentsRes.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTicketAndAgents()
  }, [fetchTicketAndAgents])

  const handleNewComment = useCallback((comment: any) => {
    setTicket((prev: any) => {
      if (!prev) return prev
      // Prevent duplicates
      if (prev.comments?.some((c: any) => c.id === comment.id)) return prev
      return { ...prev, comments: [...(prev.comments || []), comment] }
    })
  }, [])

  const handleAssign = async (assigneeId: string) => {
    setAssigning(true)
    try {
      const res = await apiFetch(`/support/tickets/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: assigneeId || null })
      })
      if (res.ok) fetchTicketAndAgents()
    } catch (e) {
      alert("Error al asignar ticket")
    } finally {
      setAssigning(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await apiFetch(`/support/tickets/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) fetchTicketAndAgents()
    } catch (e) {
      alert("Error al cambiar estado")
    }
  }

  if (loading) return <div className="p-10 max-w-4xl mx-auto space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40 w-full" /></div>
  if (error || !ticket) return <div className="p-10 text-center text-destructive">{error}</div>

  const priority = priorityConfig[ticket.priority] ?? priorityConfig.MEDIUM
  const isTicketActive = ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED'
  const assignee = agents.find((a) => a.id === ticket.assigneeId)

  // Panel de control: misma información para supervisor y trabajador, pero
  // solo el supervisor puede reasignar el ticket u otorgarse acceso al colegio.
  const controlPanel = (
    <div className="space-y-4 p-4">
      <div>
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colegio</Label>
        <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {ticket.tenant?.name ?? "Colegio desconocido"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categoría</Label>
          <p className="mt-1 text-sm text-foreground">{ticket.category || "General"}</p>
        </div>
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prioridad</Label>
          <p className={`mt-1 text-sm ${priority.color}`}>{priority.label}</p>
        </div>
      </div>

      <div>
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</Label>
        <select
          className="mt-1 flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          value={ticket.status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="OPEN">Abierto</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="WAITING_ON_CUSTOMER">Esperando al cliente</option>
          <option value="RESOLVED">Resuelto</option>
          <option value="CLOSED">Cerrado</option>
        </select>
      </div>

      <div>
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Asignado a
        </Label>
        {isSupervisor ? (
          <>
            <select
              className="mt-1 flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={ticket.assigneeId || ""}
              onChange={(e) => handleAssign(e.target.value)}
              disabled={assigning}
            >
              <option value="">Sin asignar</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">Solo el supervisor reasigna.</p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium text-foreground">
            {assignee ? `${assignee.firstName} ${assignee.lastName}` : "Sin asignar"}
          </p>
        )}
      </div>

      <AccessSessionPanel
        ticketId={id}
        tenantId={ticket.tenantId}
        currentUserId={currentUser}
        isSupervisor={isSupervisor}
        isTicketActive={isTicketActive}
        onEnterTenant={() => router.push("/admin")}
      />
    </div>
  )

  return (
    <SupportChatThread
      ticket={ticket}
      ticketId={id}
      currentUserId={currentUser}
      statusBadge={statusConfig[ticket.status]}
      backHref="/superadmin/support"
      heightMode="screen"
      isMine={(comment) => comment.author?.memberships?.some((m: any) => SUPPORT_TEAM_ROLES.includes(m.role))}
      renderAuthorLabel={(comment, mine) => (
        <span className={mine ? "text-blue-100" : "text-primary"}>
          {comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : "Usuario"}
          {comment.authorId === currentUser && <span className="ml-1.5 opacity-70">(tú)</span>}
        </span>
      )}
      allowInternalNotes
      getInputPlaceholder={(isInternal) =>
        isInternal ? "Escribe una nota interna oculta para el cliente..." : "Escribe tu respuesta para el cliente..."
      }
      onReplySent={fetchTicketAndAgents}
      onNewComment={handleNewComment}
      sidePanel={controlPanel}
      sidePanelTitle="Panel de control"
      sidePanelDescription="Misma información para supervisor y agente."
    />
  )
}
