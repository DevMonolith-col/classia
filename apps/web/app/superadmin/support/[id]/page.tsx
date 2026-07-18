"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Send, Lock, Clock, CheckCircle2, XCircle, AlertTriangle, User, Paperclip, FileIcon, LogIn, ChevronDown, Info, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { API_URL } from "@/lib/env"
import { getAccessToken, decodeJwt } from "@/lib/auth"
import { RemoteImage } from "@/components/shared/remote-image"
import { AttachmentPreviewDialog } from "@/components/shared/attachment-preview-dialog"

const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
  OPEN: { label: "Abierto", color: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", color: "bg-amber-100 text-amber-800", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Esperando cliente", color: "bg-purple-100 text-purple-800", icon: User },
  RESOLVED: { label: "Resuelto", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", color: "bg-slate-100 text-slate-800", icon: XCircle },
}

const priorityConfig: Record<string, { label: string, color: string }> = {
  LOW: { label: "Baja", color: "text-slate-500" },
  MEDIUM: { label: "Media", color: "text-blue-500" },
  HIGH: { label: "Alta", color: "text-amber-500" },
  CRITICAL: { label: "Crítica", color: "text-red-500 font-bold" },
}

export default function SuperAdminTicketDetail() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const jwt = decodeJwt(getAccessToken() || "")
  const currentUser = jwt?.sub
  const isSupervisor = jwt?.role === "SUPER_ADMIN" || jwt?.role === "SUPPORT_SUPERVISOR"
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [reply, setReply] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [replying, setReplying] = useState(false)

  const [previewAttachmentKey, setPreviewAttachmentKey] = useState<string | null>(null)
  const [previewAttachmentName, setPreviewAttachmentName] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [assigning, setAssigning] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [socket, setSocket] = useState<Socket | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const fetchTicketAndAgents = async () => {
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
  }

  useEffect(() => {
    fetchTicketAndAgents()

    const token = getAccessToken()
    if (!token) return

    const newSocket: Socket = io(`${API_URL}/support`, {
      auth: { token },
      transports: ["websocket"],
    })
    setSocket(newSocket)

    newSocket.on("connect", () => {
      newSocket.emit("ticket:join", { ticketId: id })
    })

    newSocket.on("ticket:comment", (payload) => {
      if (payload.ticketId === id) {
        setTicket((prev: any) => {
          if (!prev) return prev
          // Prevent duplicates
          if (prev.comments?.some((c: any) => c.id === payload.comment.id)) return prev
          return { ...prev, comments: [...(prev.comments || []), payload.comment] }
        })
      }
    })

    newSocket.on("typing", (payload) => {
      if (payload.ticketId === id) {
        setTypingUsers(prev => {
          const next = new Set(prev)
          if (payload.isTyping) next.add(payload.userId)
          else next.delete(payload.userId)
          return next
        })
      }
    })

    return () => {
      newSocket.emit("ticket:leave", { ticketId: id })
      newSocket.disconnect()
    }
  }, [id])

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

  const handleImpersonate = async () => {
    if (!ticket?.tenantId) return
    setImpersonating(true)
    try {
      const res = await apiFetch("/auth/impersonate", {
        method: "POST",
        body: JSON.stringify({ tenantId: ticket.tenantId })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Error de impersonation")
      }
      router.push("/admin")
    } catch (e: any) {
      alert(e.message)
      setImpersonating(false)
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

  const handleReply = async () => {
    if (!reply.trim() && !attachment) return
    setReplying(true)
    try {
      let attachmentKey: string | undefined
      let attachmentName: string | undefined

      if (attachment) {
        const formData = new FormData()
        formData.append("file", attachment)
        const uploadRes = await apiFetch("/files", {
          method: "POST",
          body: formData,
        })
        if (!uploadRes.ok) throw new Error("Error subiendo archivo")
        const uploadData = await uploadRes.json()
        attachmentKey = uploadData.key
        attachmentName = attachment.name
      }

      const res = await apiFetch(`/support/tickets/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          content: reply || (attachment ? "Archivo adjunto" : ""),
          isInternal,
          attachmentKey,
          attachmentName
        })
      })

      if (res.ok) {
        setReply("")
        setIsInternal(false)
        setAttachment(null)
        fetchTicketAndAgents()
      }
    } catch (e: any) {
      alert(e.message || "Error al responder")
    } finally {
      setReplying(false)
    }
  }

  if (loading) return <div className="p-10 max-w-4xl mx-auto space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40 w-full" /></div>
  if (error || !ticket) return <div className="p-10 text-center text-destructive">{error}</div>

  const status = statusConfig[ticket.status]
  const StatusIcon = status.icon
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

      {isSupervisor && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">Acceso al colegio</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isTicketActive
              ? "Entra directamente al colegio para diagnosticar o corregir el problema."
              : "El ticket ya está cerrado; el acceso solo aplica a tickets activos."}
          </p>
          <Button
            size="sm"
            className="mt-2 w-full gap-2"
            onClick={handleImpersonate}
            disabled={impersonating || !isTicketActive}
          >
            <LogIn className="h-3.5 w-3.5" /> Entrar al sistema
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Chat: independiente del panel de control */}
      <div className="flex h-full min-w-0 flex-1 flex-col relative">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/superadmin/support"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${status.color} shrink-0 px-1.5 h-5 text-[10px]`}>
                  <StatusIcon className="h-2.5 w-2.5 mr-1" />{status.label}
                </Badge>
                {ticket.priority === 'CRITICAL' && (
                  <Badge variant="destructive" className="animate-pulse shrink-0 px-1.5 h-5 text-[10px]">Crítica</Badge>
                )}
              </div>
              <h1 className="mt-0.5 line-clamp-1 text-sm font-bold sm:text-base">{ticket.title}</h1>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={() => setShowDetails((s) => !s)}>
              <Info className="h-3.5 w-3.5" />
              Detalles
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            </Button>
          </div>
          {showDetails && (
            <div className="mt-2 rounded-lg border border-border bg-card lg:hidden">
              {controlPanel}
            </div>
          )}
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto w-full" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
        }}>
          <div className="w-full px-4 py-4 sm:px-6 space-y-3">
            {/* Initial Ticket Description as a Chat Bubble */}
            <div className={`flex items-end gap-2 ${ticket.authorId === currentUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2 shadow-sm ${
                  ticket.authorId === currentUser
                    ? "rounded-[20px] rounded-br-md bg-blue-500 text-white"
                    : "rounded-[20px] rounded-bl-md bg-secondary text-foreground"
                } ${!ticket.comments?.length && ticket.authorId === currentUser ? 'rounded-br-[20px]' : ''} ${!ticket.comments?.length && ticket.authorId !== currentUser ? 'rounded-bl-[20px]' : ''}`}>

                {ticket.authorId !== currentUser && (
                  <p className="text-[11px] font-medium text-primary mb-2 border-b border-primary/20 pb-1">
                    {ticket.author ? `${ticket.author.firstName} ${ticket.author.lastName}` : 'Usuario'} ha reportado un problema
                  </p>
                )}

                <div className="space-y-2 text-[14px]">
                  <div className="bg-black/10 dark:bg-black/20 p-2 rounded-md">
                    <p><span className="font-semibold opacity-90">Asunto:</span> {ticket.title}</p>
                    <p><span className="font-semibold opacity-90">Categoría:</span> {ticket.category || "General"}</p>
                  </div>

                  <div>
                    <p className="font-semibold opacity-90 mb-0.5">Descripción:</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                </div>

                {ticket.attachmentKey && (
                  ticket.attachmentName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <div className="mt-2 relative rounded-lg overflow-hidden border border-white/20">
                      <RemoteImage
                        fileKey={ticket.attachmentKey}
                        alt="Adjunto"
                        className="max-w-full max-h-[300px] object-contain"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setPreviewAttachmentKey(ticket.attachmentKey)
                        setPreviewAttachmentName(ticket.attachmentName || "Adjunto")
                      }}
                      className="inline-flex items-center gap-1 mt-2 text-xs hover:underline px-3 py-2 rounded-xl border transition-colors text-white bg-white/20 border-white/30 hover:bg-white/30"
                    >
                      <FileIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate max-w-[150px]">{ticket.attachmentName || "Adjunto"}</span>
                    </button>
                  )
                )}

                <div className={`mt-1 flex items-center justify-end gap-1 ${ticket.authorId === currentUser ? 'text-blue-100' : 'text-muted-foreground'}`}>
                  <span className="text-[10px]">
                    {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Comments */}
            {ticket.comments?.map((comment: any, index: number) => {
              const isMe = comment.authorId === currentUser
              const isLastInGroup = index === ticket.comments.length - 1 || ticket.comments[index + 1]?.authorId !== comment.authorId
              const isSupportTeam = comment.author?.memberships?.some((m: any) => ["SUPER_ADMIN", "SUPPORT_SUPERVISOR", "SUPPORT_AGENT"].includes(m.role))

              return (
                <div key={comment.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2 shadow-sm ${
                      isMe
                        ? "rounded-[20px] rounded-br-md bg-amber-500 text-white"
                        : (isSupportTeam ? "rounded-[20px] rounded-bl-md bg-amber-100 text-amber-900 border border-amber-200" : "rounded-[20px] rounded-bl-md bg-secondary text-foreground")
                    } ${isLastInGroup && isMe ? "rounded-br-[20px]" : ""} ${isLastInGroup && !isMe ? "rounded-bl-[20px]" : ""}`
                  }>
                    {!isMe && (
                      <p className={`text-[11px] font-medium mb-1 ${isSupportTeam ? 'text-amber-700' : 'text-primary'}`}>
                        {comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : 'Usuario'}
                        {isSupportTeam && <span className="ml-1.5 opacity-70">· Soporte</span>}
                        {comment.isInternal && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-amber-200/50 text-amber-800">NOTA INTERNA</span>}
                      </p>
                    )}
                    {isMe && comment.isInternal && (
                      <p className="text-[9px] font-medium mb-1 text-amber-100">NOTA INTERNA</p>
                    )}
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{comment.content}</p>

                    {comment.attachmentKey && (
                      comment.attachmentName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <div className={`mt-2 relative rounded-lg overflow-hidden border ${isMe ? 'border-white/20' : 'border-border'}`}>
                          <RemoteImage
                            fileKey={comment.attachmentKey}
                            alt="Adjunto"
                            className="max-w-full max-h-[300px] object-contain"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPreviewAttachmentKey(comment.attachmentKey)
                            setPreviewAttachmentName(comment.attachmentName || "Adjunto")
                          }}
                          className={`inline-flex items-center gap-1 mt-2 text-xs hover:underline px-3 py-2 rounded-xl border transition-colors ${
                            isMe
                              ? 'text-white bg-white/20 border-white/30 hover:bg-white/30'
                              : 'text-foreground bg-background border-border hover:bg-muted'
                          }`}
                        >
                          <FileIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate max-w-[150px]">{comment.attachmentName || "Adjunto"}</span>
                        </button>
                      )
                    )}

                    <div className={`mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-amber-100' : (isSupportTeam ? 'text-amber-700/70' : 'text-muted-foreground')}`}>
                      <span className="text-[10px]">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {typingUsers.size > 0 && (
              <div className="flex justify-start">
                <div className="bg-secondary text-muted-foreground rounded-[20px] px-4 py-2 flex items-center gap-1 text-sm shadow-sm">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-75">.</span>
                  <span className="animate-bounce delay-150">.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {isTicketActive ? (
          <div className="p-4 bg-background border-t border-border mt-auto sticky bottom-0 flex items-end gap-2">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-blue-500 hover:bg-secondary transition-colors">
                <Paperclip className="h-5 w-5" />
              </div>
            </label>

            <div className="relative flex-1 flex flex-col gap-1">
              {attachment && (
                <div className="absolute -top-8 left-2 bg-secondary/80 backdrop-blur text-xs px-3 py-1.5 rounded-full flex items-center gap-2 border shadow-sm z-10">
                  <span className="truncate max-w-[150px]">{attachment.name}</span>
                  <button onClick={() => setAttachment(null)} className="text-destructive hover:bg-destructive/10 rounded-full p-0.5">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Textarea
                placeholder={isInternal ? "Escribe una nota interna oculta para el cliente..." : "Escribe tu respuesta para el cliente..."}
                value={reply}
                onChange={e => {
                  setReply(e.target.value)
                  if (socket && !isInternal) {
                    socket.emit("typing:start", { ticketId: id })
                    clearTimeout((window as any).typingTimeout)
                    ;(window as any).typingTimeout = setTimeout(() => {
                      socket.emit("typing:stop", { ticketId: id })
                    }, 1500)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
                className={`min-h-[36px] max-h-[120px] resize-none rounded-2xl px-4 py-2 text-[15px] focus-visible:ring-1 ${isInternal ? 'bg-amber-50 dark:bg-amber-900/10 placeholder:text-amber-700/50 text-amber-900' : 'bg-secondary/50'}`}
                rows={1}
              />
            </div>

            <Button
              size="icon"
              className={`h-9 w-9 shrink-0 rounded-full transition-colors ${isInternal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'}`}
              onClick={handleReply}
              disabled={replying || (!reply.trim() && !attachment)}
            >
              <Send className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1.5 ml-1">
              <Switch
                id="internal-mode"
                checked={isInternal}
                onCheckedChange={setIsInternal}
              />
              <Label htmlFor="internal-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1" title="Activar para dejar un comentario solo visible para soporte">
                <Lock className="h-3 w-3 text-amber-500" />
                <span className="hidden sm:inline">Interno</span>
              </Label>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-secondary/30 text-center border-t border-border mt-auto">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-sm">Este ticket ha sido cerrado y ya no admite respuestas.</p>
            </div>
          </div>
        )}
      </div>

      {/* Panel de control: distinto del chat, visible siempre en escritorio */}
      <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-card lg:flex">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Panel de control</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Misma información para supervisor y agente.</p>
        </div>
        {controlPanel}
      </aside>

      <AttachmentPreviewDialog
        open={!!previewAttachmentKey}
        onOpenChange={(open) => !open && setPreviewAttachmentKey(null)}
        fileKey={previewAttachmentKey}
        fileName={previewAttachmentName}
      />
    </div>
  )
}
