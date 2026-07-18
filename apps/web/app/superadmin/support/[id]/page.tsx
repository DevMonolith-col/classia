"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Send, Lock, Clock, CheckCircle2, XCircle, AlertTriangle, User, Paperclip, FileIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"
import { LogIn } from "lucide-react"
import { io, Socket } from "socket.io-client"
import { API_URL } from "@/lib/env"
import { getAccessToken } from "@/lib/auth"

const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
  OPEN: { label: "Abierto", color: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", color: "bg-amber-100 text-amber-800", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Esperando cliente", color: "bg-purple-100 text-purple-800", icon: User },
  RESOLVED: { label: "Resuelto", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", color: "bg-slate-100 text-slate-800", icon: XCircle },
}

export default function SuperAdminTicketDetail() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  const [reply, setReply] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [replying, setReplying] = useState(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [assigning, setAssigning] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [socket, setSocket] = useState<Socket | null>(null)

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

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/superadmin/support"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volver a Soporte B2B</p>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold line-clamp-1">{ticket.title}</h1>
                <Badge variant="outline" className={status.color}><StatusIcon className="h-3 w-3 mr-1"/>{status.label}</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
              className="flex h-9 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={ticket.assigneeId || ""}
              onChange={(e) => handleAssign(e.target.value)}
              disabled={assigning}
            >
              <option value="">Sin asignar</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </select>
            <select 
              className="flex h-9 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="OPEN">Marcar como Abierto</option>
              <option value="IN_PROGRESS">Marcar En Progreso</option>
              <option value="WAITING_ON_CUSTOMER">Esperando al cliente</option>
              <option value="RESOLVED">Marcar Resuelto</option>
              <option value="CLOSED">Cerrar Ticket</option>
            </select>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">

      {ticket.assigneeId && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="text-sm">
            <p className="font-semibold text-primary">Acceso de Soporte Autorizado</p>
            <p className="text-muted-foreground">Como este ticket está asignado y activo, tienes permiso para entrar al dashboard del colegio {ticket.tenant.name}.</p>
          </div>
          <Button onClick={handleImpersonate} disabled={impersonating} className="gap-2 shrink-0">
            <LogIn className={`h-4 w-4 ${impersonating ? 'animate-pulse' : ''}`} />
            Entrar al Colegio
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="prose dark:prose-invert max-w-none text-sm">
            {ticket.description}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 pt-4">
        <h3 className="font-semibold text-lg">Historial de Conversación</h3>
        
        {ticket.comments?.map((comment: any) => (
          <div key={comment.id} className={`p-4 rounded-lg border ${comment.isInternal ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-background'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {comment.authorId === ticket.authorId ? 'Cliente (Colegio)' : 'Soporte SaaS'}
                </span>
                {comment.isInternal && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                    <Lock className="h-3 w-3 mr-1" /> Nota Interna
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            {comment.attachmentKey && (
              <a 
                href={`/api/files/url?key=${comment.attachmentKey}`} 
                target="_blank" 
                className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline bg-primary/5 px-2 py-1 rounded border border-primary/20"
              >
                <FileIcon className="h-3 w-3" />
                {comment.attachmentName || "Adjunto"}
              </a>
            )}
          </div>
        ))}
        
        {typingUsers.size > 0 && (
          <div className="text-sm text-muted-foreground italic flex items-center gap-2 px-4 py-2">
            <span className="flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce delay-75">.</span>
              <span className="animate-bounce delay-150">.</span>
            </span>
            El cliente está escribiendo...
          </div>
        )}
      </div>

      <Card className="mt-8 border-primary/20 shadow-sm sticky bottom-4">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <Label className="font-semibold">Añadir respuesta</Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="internal-note" className="text-sm cursor-pointer">Nota Interna (Oculta al cliente)</Label>
              <Switch id="internal-note" checked={isInternal} onCheckedChange={setIsInternal} />
            </div>
          </div>
          <Textarea 
            placeholder={isInternal ? "Escribe una nota para tu equipo técnico..." : "Escribe tu respuesta al colegio..."}
            className={`min-h-[100px] ${isInternal ? 'bg-amber-50/50 focus-visible:ring-amber-500' : ''}`}
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
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
              <label htmlFor="file-upload" className="cursor-pointer text-muted-foreground hover:text-foreground">
                <Paperclip className="h-5 w-5" />
              </label>
              {attachment && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {attachment.name}
                  <button onClick={() => setAttachment(null)} className="text-destructive hover:underline ml-1">
                    (quitar)
                  </button>
                </span>
              )}
            </div>
            <Button onClick={handleReply} disabled={replying || (!reply.trim() && !attachment)} className={isInternal ? "bg-amber-600 hover:bg-amber-700 text-white" : "gap-2"}>
              {isInternal ? <Lock className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {replying ? "Enviando..." : (isInternal ? "Guardar Nota Interna" : "Enviar Respuesta")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
  )
}
