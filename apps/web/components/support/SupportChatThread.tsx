"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileIcon,
  Info,
  Lock,
  Paperclip,
  Send,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AttachmentPreviewDialog } from "@/components/shared/attachment-preview-dialog"
import { RemoteImage } from "@/components/shared/remote-image"
import { apiFetch } from "@/lib/api-client"
import { getAccessToken } from "@/lib/auth"
import { API_URL } from "@/lib/env"
import { attachTokenRefresh } from "@/lib/socket"

// Fondo con textura sutil, igual al de ambas vistas originales.
const BACKGROUND_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"

const ATTACHMENT_IMAGE_PATTERN = /\.(jpg|jpeg|png|gif|webp)$/i

export type StatusBadgeInfo = {
  label: string
  colorClass: string
  icon: LucideIcon
}

export type SupportChatThreadProps = {
  /** Ticket completo (incluye `comments[]`); mismo shape sin tipar que usaban ambas páginas. */
  ticket: any
  ticketId: string
  currentUserId: string | undefined
  statusBadge: StatusBadgeInfo

  /** Ruta del botón "volver". */
  backHref: string
  /** Cuando es true, el botón "volver" solo se muestra en móvil (vista Cliente, que ya tiene la bandeja visible en escritorio). */
  hideBackOnDesktop?: boolean

  /** Regla de alineación de burbujas: distinta por vista (Cliente = "soy yo"; Agente = "es del equipo de soporte"). */
  isMine: (comment: any) => boolean
  /**
   * Etiqueta mostrada sobre la burbuja; `null` la oculta (p. ej. la vista Cliente
   * la oculta cuando `isMine` es true). Cada vista decide qué nombre mostrar y
   * bajo qué condición.
   *
   * IMPORTANTE — contrato de color: `SupportChatThread` NO fija un color de
   * texto para el nodo devuelto (el `<p>` contenedor solo aporta tamaño/peso de
   * fuente). El nodo que retorna esta función es responsable de definir su
   * propio color (p. ej. envolviéndolo en `<span className="text-blue-100">` o
   * `text-primary` según corresponda a la burbuja). Si se omite, el texto
   * hereda `currentColor` del contenedor padre, que puede no tener contraste
   * suficiente sobre burbujas de color. Ver `renderAuthorLabel` en
   * `superadmin/support/[id]/page.tsx` y `admin/soporte/[id]/page.tsx` para
   * los dos usos ya validados.
   */
  renderAuthorLabel: (comment: any, isMine: boolean) => ReactNode | null

  /** Habilita el toggle "Interno" en el composer (solo vista Agente). */
  allowInternalNotes?: boolean
  /** Placeholder del textarea; recibe si el modo interno está activo. */
  getInputPlaceholder?: (isInternal: boolean) => string
  /** Mensaje mostrado cuando el ticket ya no admite respuestas. */
  closedMessage?: string
  /** Se llama tras enviar una respuesta con éxito, para que la página recargue el ticket. */
  onReplySent: () => void | Promise<void>
  /** Se llama cuando llega un comentario nuevo por socket; la página decide cómo fusionarlo en su estado. */
  onNewComment: (comment: any) => void

  /** Slot opcional para el panel de control lateral (solo vista Agente). Sin este prop, el chat ocupa el 100% del ancho. */
  sidePanel?: ReactNode
  sidePanelTitle?: string
  sidePanelDescription?: string

  /** "screen" = ruta standalone a pantalla completa (Agente); "full" = anidada en un layout que ya reserva el alto (Cliente). */
  heightMode?: "screen" | "full"
}

export function SupportChatThread({
  ticket,
  ticketId,
  currentUserId,
  statusBadge,
  backHref,
  hideBackOnDesktop = false,
  isMine,
  renderAuthorLabel,
  allowInternalNotes = false,
  getInputPlaceholder = () => "Escribe tu mensaje...",
  closedMessage = "Este ticket ha sido cerrado y ya no admite respuestas.",
  onReplySent,
  onNewComment,
  sidePanel,
  sidePanelTitle,
  sidePanelDescription,
  heightMode = "full",
}: SupportChatThreadProps) {
  const [reply, setReply] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [replying, setReplying] = useState(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [previewAttachmentKey, setPreviewAttachmentKey] = useState<string | null>(null)
  const [previewAttachmentName, setPreviewAttachmentName] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [socket, setSocket] = useState<Socket | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Conexión de socket: idéntica en ambas vistas originales (mismo namespace,
  // mismos eventos, mismo join/leave). Se preservan nombres de evento y payloads.
  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const newSocket: Socket = io(`${API_URL}/support`, {
      auth: { token },
      transports: ["websocket"],
    })
    setSocket(newSocket)
    attachTokenRefresh(newSocket)

    newSocket.on("connect", () => {
      newSocket.emit("ticket:join", { ticketId })
    })

    newSocket.on("ticket:comment", (payload) => {
      if (payload.ticketId === ticketId) {
        onNewComment(payload.comment)
      }
    })

    newSocket.on("typing", (payload) => {
      if (payload.ticketId === ticketId) {
        setTypingUsers((prev) => {
          const next = new Set(prev)
          if (payload.isTyping) next.add(payload.userId)
          else next.delete(payload.userId)
          return next
        })
      }
    })

    return () => {
      newSocket.emit("ticket:leave", { ticketId })
      newSocket.disconnect()
    }
  }, [ticketId, onNewComment])

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

      const res = await apiFetch(`/support/tickets/${ticketId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          content: reply || (attachment ? "Archivo adjunto" : ""),
          isInternal: allowInternalNotes ? isInternal : false,
          attachmentKey,
          attachmentName,
        }),
      })

      if (res.ok) {
        setReply("")
        setIsInternal(false)
        setAttachment(null)
        await onReplySent()
      }
    } catch (e: any) {
      alert(e.message || "Error al responder")
    } finally {
      setReplying(false)
    }
  }

  const StatusIcon = statusBadge.icon
  const isTicketActive = ticket.status !== "RESOLVED" && ticket.status !== "CLOSED"
  const placeholder = getInputPlaceholder(isInternal)

  return (
    <div
      className={`flex w-full bg-background ${
        heightMode === "screen" ? "h-screen overflow-hidden" : "h-full"
      }`}
    >
      {/* Chat: independiente del panel de control */}
      <div className="flex h-full min-w-0 flex-1 flex-col relative">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={hideBackOnDesktop ? "sm:hidden shrink-0" : "shrink-0"}
              asChild
            >
              <Link href={backHref}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${statusBadge.colorClass} shrink-0 px-1.5 h-5 text-[10px]`}>
                  <StatusIcon className="h-2.5 w-2.5 mr-1" />
                  {statusBadge.label}
                </Badge>
                {ticket.priority === "CRITICAL" && (
                  <Badge variant="destructive" className="animate-pulse shrink-0 px-1.5 h-5 text-[10px]">
                    Crítica
                  </Badge>
                )}
              </div>
              <h1 className="mt-0.5 line-clamp-1 text-sm font-bold sm:text-base">{ticket.title}</h1>
            </div>
            {sidePanel && (
              <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={() => setShowDetails((s) => !s)}>
                <Info className="h-3.5 w-3.5" />
                Detalles
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </Button>
            )}
          </div>
          {sidePanel && showDetails && (
            <div className="mt-2 rounded-lg border border-border bg-card lg:hidden">{sidePanel}</div>
          )}
        </header>

        <div
          className="flex-1 min-h-0 overflow-y-auto w-full"
          style={{ backgroundImage: BACKGROUND_PATTERN }}
        >
          <div className="w-full px-4 py-4 sm:px-6 space-y-3">
            {/* Descripción inicial del ticket, como burbuja de chat */}
            <div className={`flex items-end gap-2 ${ticket.authorId === currentUserId ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-2 shadow-sm ${
                  ticket.authorId === currentUserId
                    ? "rounded-[20px] rounded-br-md bg-blue-500 text-white"
                    : "rounded-[20px] rounded-bl-md bg-secondary text-foreground"
                } ${!ticket.comments?.length && ticket.authorId === currentUserId ? "rounded-br-[20px]" : ""} ${
                  !ticket.comments?.length && ticket.authorId !== currentUserId ? "rounded-bl-[20px]" : ""
                }`}
              >
                {ticket.authorId !== currentUserId && (
                  <p className="text-[11px] font-medium text-primary mb-2 border-b border-primary/20 pb-1">
                    {ticket.author ? `${ticket.author.firstName} ${ticket.author.lastName}` : "Usuario"} ha reportado un
                    problema
                  </p>
                )}

                <div className="space-y-2 text-[14px]">
                  <div className="bg-black/10 dark:bg-black/20 p-2 rounded-md">
                    <p>
                      <span className="font-semibold opacity-90">Asunto:</span> {ticket.title}
                    </p>
                    <p>
                      <span className="font-semibold opacity-90">Categoría:</span> {ticket.category || "General"}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold opacity-90 mb-0.5">Descripción:</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                </div>

                {ticket.attachmentKey &&
                  (ticket.attachmentName?.match(ATTACHMENT_IMAGE_PATTERN) ? (
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
                  ))}

                <div
                  className={`mt-1 flex items-center justify-end gap-1 ${
                    ticket.authorId === currentUserId ? "text-blue-100" : "text-muted-foreground"
                  }`}
                >
                  <span className="text-[10px]">
                    {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>

            {/* Comentarios. La regla de "qué lado" y "qué nombre mostrar" la decide
                cada página vía isMine/renderAuthorLabel — acá solo se renderiza. */}
            {ticket.comments?.map((comment: any, index: number) => {
              const mine = isMine(comment)
              const authorLabel = renderAuthorLabel(comment, mine)
              const isLastInGroup =
                index === ticket.comments.length - 1 || ticket.comments[index + 1]?.authorId !== comment.authorId
              const bubbleTone = comment.isInternal ? "bg-slate-700 dark:bg-slate-800" : "bg-blue-500"

              return (
                <div key={comment.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-4 py-2 shadow-sm ${
                      mine ? `rounded-[20px] rounded-br-md ${bubbleTone} text-white` : "rounded-[20px] rounded-bl-md bg-secondary text-foreground"
                    } ${isLastInGroup && mine ? "rounded-br-[20px]" : ""} ${isLastInGroup && !mine ? "rounded-bl-[20px]" : ""}`}
                  >
                    {/* El badge NOTA INTERNA es independiente de authorLabel: una vista
                        puede ocultar el nombre (p. ej. "es mío, no hace falta firmarlo")
                        sin que eso oculte la marca de nota interna. */}
                    {((authorLabel !== null && authorLabel !== undefined) || comment.isInternal) && (
                      <p className="text-[11px] font-medium mb-1">
                        {authorLabel}
                        {comment.isInternal && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-white/15 text-white">
                            <Lock className="h-2.5 w-2.5" />
                            NOTA INTERNA
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{comment.content}</p>

                    {comment.attachmentKey &&
                      (comment.attachmentName?.match(ATTACHMENT_IMAGE_PATTERN) ? (
                        <div className={`mt-2 relative rounded-lg overflow-hidden border ${mine ? "border-white/20" : "border-border"}`}>
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
                            mine
                              ? "text-white bg-white/20 border-white/30 hover:bg-white/30"
                              : "text-foreground bg-background border-border hover:bg-muted"
                          }`}
                        >
                          <FileIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate max-w-[150px]">{comment.attachmentName || "Adjunto"}</span>
                        </button>
                      ))}

                    <div className={`mt-1 flex items-center justify-end gap-1 ${mine ? "text-blue-100" : "text-muted-foreground"}`}>
                      <span className="text-[10px]">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
          <div className="w-full p-4 bg-background border-t border-border mt-auto sticky bottom-0 flex items-center gap-2">
            <input
              type="file"
              id={`file-upload-${ticketId}`}
              className="hidden"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            />
            <label htmlFor={`file-upload-${ticketId}`} className="cursor-pointer">
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
                placeholder={placeholder}
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value)
                  if (socket && !isInternal) {
                    socket.emit("typing:start", { ticketId })
                    clearTimeout((window as any).typingTimeout)
                    ;(window as any).typingTimeout = setTimeout(() => {
                      socket.emit("typing:stop", { ticketId })
                    }, 1500)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleReply()
                  }
                }}
                className={`min-h-[36px] max-h-[120px] resize-none rounded-2xl px-4 py-2 text-[15px] focus-visible:ring-1 ${
                  isInternal
                    ? "bg-slate-100 dark:bg-slate-800/60 placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                    : "bg-secondary/50"
                }`}
                rows={1}
              />
            </div>

            <Button
              size="icon"
              className={`h-9 w-9 shrink-0 rounded-full transition-colors ${
                isInternal ? "bg-slate-700 hover:bg-slate-800" : "bg-blue-500 hover:bg-blue-600"
              }`}
              onClick={handleReply}
              disabled={replying || (!reply.trim() && !attachment)}
            >
              <Send className="h-4 w-4" />
            </Button>

            {allowInternalNotes && (
              <div className="flex items-center gap-1.5 ml-1">
                <Switch id={`internal-mode-${ticketId}`} checked={isInternal} onCheckedChange={setIsInternal} />
                <Label
                  htmlFor={`internal-mode-${ticketId}`}
                  className="text-xs font-medium cursor-pointer flex items-center gap-1"
                  title="Activar para dejar un comentario solo visible para soporte"
                >
                  <Lock className="h-3 w-3 text-amber-500" />
                  <span className="hidden sm:inline">Interno</span>
                </Label>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-secondary/30 text-center border-t border-border mt-auto">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-sm">{closedMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Panel de control: solo si la página lo provee (vista Agente) */}
      {sidePanel && (
        <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-card lg:flex">
          {(sidePanelTitle || sidePanelDescription) && (
            <div className="border-b border-border p-4">
              {sidePanelTitle && <h2 className="text-sm font-semibold text-foreground">{sidePanelTitle}</h2>}
              {sidePanelDescription && <p className="mt-0.5 text-xs text-muted-foreground">{sidePanelDescription}</p>}
            </div>
          )}
          {sidePanel}
        </aside>
      )}

      <AttachmentPreviewDialog
        open={!!previewAttachmentKey}
        onOpenChange={(open) => !open && setPreviewAttachmentKey(null)}
        fileKey={previewAttachmentKey}
        fileName={previewAttachmentName}
      />
    </div>
  )
}
