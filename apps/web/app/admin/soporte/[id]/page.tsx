"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Send, Clock, CheckCircle2, XCircle, AlertTriangle, User, LifeBuoy, Paperclip, FileIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { API_URL } from "@/lib/env"
import { getAccessToken } from "@/lib/auth"

const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
  OPEN: { label: "Abierto", color: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", color: "bg-amber-100 text-amber-800", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Esperando tu respuesta", color: "bg-purple-100 text-purple-800", icon: User },
  RESOLVED: { label: "Resuelto", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", color: "bg-slate-100 text-slate-800", icon: XCircle },
}

export default function AdminTicketDetail() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  const [reply, setReply] = useState("")
  const [replying, setReplying] = useState(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [socket, setSocket] = useState<Socket | null>(null)

  const fetchTicket = async () => {
    try {
      const res = await apiFetch(`/support/tickets/${id}`)
      if (!res.ok) throw new Error("No se pudo cargar el ticket")
      setTicket(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTicket()

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
          isInternal: false,
          attachmentKey,
          attachmentName
        })
      })
      if (res.ok) {
        setReply("")
        setAttachment(null)
        fetchTicket()
      }
    } catch (e: any) {
      alert(e.message || "Error al responder")
    } finally {
      setReplying(false)
    }
  }

  if (loading) return <div className="p-10 max-w-3xl mx-auto space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40 w-full" /></div>
  if (error || !ticket) return <div className="p-10 text-center text-destructive flex flex-col items-center"><LifeBuoy className="h-10 w-10 mb-2"/>{error}</div>

  const status = statusConfig[ticket.status]
  const StatusIcon = status.icon

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/admin/soporte"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volver a Soporte</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground line-clamp-1">{ticket.title}</h1>
              <Badge variant="outline" className={`shrink-0 w-fit ${status.color}`}>
                <StatusIcon className="h-3 w-3 mr-1"/>{status.label}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">

      <Card>
        <CardHeader className="pb-3 bg-secondary/20">
          <CardTitle className="text-base font-semibold">Descripción del problema</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
            {ticket.description}
          </div>
        </CardContent>
      </Card>

      {ticket.comments?.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="font-semibold text-lg border-b pb-2">Respuestas</h3>
          
          {ticket.comments.map((comment: any) => {
            const isMe = comment.authorId === ticket.authorId
            return (
              <div key={comment.id} className={`p-4 rounded-lg border ${isMe ? 'bg-secondary/10 ml-8 border-l-4 border-l-primary' : 'bg-primary/5 mr-8 border-l-4 border-l-blue-500'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm text-primary">
                    {isMe ? 'Tú (Colegio)' : 'Equipo de Soporte Classia'}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                {comment.attachmentKey && (
                  <a 
                    href={`/api/files/url?key=${comment.attachmentKey}`} 
                    target="_blank" 
                    className={`inline-flex items-center gap-1 mt-2 text-xs hover:underline px-2 py-1 rounded border ${isMe ? 'text-primary bg-primary/10 border-primary/20' : 'text-blue-600 bg-blue-50 border-blue-200'}`}
                  >
                    <FileIcon className="h-3 w-3" />
                    {comment.attachmentName || "Adjunto"}
                  </a>
                )}
              </div>
            )
          })}
          
          {typingUsers.size > 0 && (
            <div className="text-sm text-muted-foreground italic flex items-center gap-2 px-4 py-2">
              <span className="flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-75">.</span>
                <span className="animate-bounce delay-150">.</span>
              </span>
              El equipo de soporte está escribiendo...
            </div>
          )}
        </div>
      )}

      {(ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') ? (
        <Card className="mt-8 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Añadir una respuesta</CardTitle>
            <CardDescription>Envía más información o responde al equipo de soporte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="Escribe tu mensaje..."
              className="min-h-[100px]"
              value={reply}
              onChange={e => {
                setReply(e.target.value)
                if (socket) {
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
              <Button onClick={handleReply} disabled={replying || (!reply.trim() && !attachment)} className="gap-2">
                <Send className="h-4 w-4" />
                {replying ? "Enviando..." : "Enviar mensaje"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 p-6 bg-secondary/30 rounded-lg text-center border">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-medium text-lg">Este ticket ha sido cerrado</h3>
          <p className="text-sm text-muted-foreground">Si el problema persiste, por favor abre un nuevo ticket desde el panel principal.</p>
        </div>
      )}
    </div>
  </div>
  )
}
