"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Clock, CheckCircle2, XCircle, AlertTriangle, User, LifeBuoy } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import { getAccessToken, decodeJwt } from "@/lib/auth"
import { SupportChatThread, type StatusBadgeInfo } from "@/components/support/SupportChatThread"

const statusConfig: Record<string, StatusBadgeInfo> = {
  OPEN: { label: "Abierto", colorClass: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", colorClass: "bg-amber-100 text-amber-800", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Esperando tu respuesta", colorClass: "bg-purple-100 text-purple-800", icon: User },
  RESOLVED: { label: "Resuelto", colorClass: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", colorClass: "bg-slate-100 text-slate-800", icon: XCircle },
}

const SUPPORT_TEAM_ROLES = ["SUPER_ADMIN", "SUPPORT_SUPERVISOR", "SUPPORT_AGENT"]

export default function AdminTicketDetail() {
  const { id } = useParams() as { id: string }
  const [ticket, setTicket] = useState<any>(null)
  const currentUser = decodeJwt(getAccessToken() || "")?.sub
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchTicket = useCallback(async () => {
    try {
      const res = await apiFetch(`/support/tickets/${id}`)
      if (!res.ok) throw new Error("No se pudo cargar el ticket")
      setTicket(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  const handleNewComment = useCallback((comment: any) => {
    setTicket((prev: any) => {
      if (!prev) return prev
      if (prev.comments?.some((c: any) => c.id === comment.id)) return prev
      return { ...prev, comments: [...(prev.comments || []), comment] }
    })
  }, [])

  if (loading) return <div className="p-10 max-w-3xl mx-auto space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40 w-full" /></div>
  if (error || !ticket) return <div className="p-10 text-center text-destructive flex flex-col items-center"><LifeBuoy className="h-10 w-10 mb-2"/>{error}</div>

  return (
    <SupportChatThread
      ticket={ticket}
      ticketId={id}
      currentUserId={currentUser}
      statusBadge={statusConfig[ticket.status]}
      backHref="/admin/soporte"
      hideBackOnDesktop
      isMine={(comment) => comment.authorId === currentUser}
      renderAuthorLabel={(comment, mine) => {
        if (mine) return null
        const isSupportTeam = comment.author?.memberships?.some((m: any) => SUPPORT_TEAM_ROLES.includes(m.role))
        return (
          <span className={isSupportTeam ? "text-blue-500" : "text-primary"}>
            {isSupportTeam ? "Equipo de Soporte" : (comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : "Usuario")}
          </span>
        )
      }}
      closedMessage="Este ticket ha sido cerrado. Si el problema persiste, abre un nuevo ticket."
      onReplySent={fetchTicket}
      onNewComment={handleNewComment}
    />
  )
}
