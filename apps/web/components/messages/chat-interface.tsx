"use client"

import { useState, useRef, useEffect } from "react"
import {
  Search,
  Plus,
  MoreHorizontal,
  Send,
  Image as ImageIcon,
  Paperclip,
  ArrowLeft,
  Check,
  CheckCheck,
  AlertCircle,
  RotateCw,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  content: string
  timestamp: Date
  sender: "user" | "other"
  status: "sending" | "sent" | "delivered" | "read" | "failed"
  type: "text" | "image" | "file"
}

export interface Conversation {
  id: string
  name: string
  avatar?: string
  initials: string
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  online?: boolean
  typing?: boolean
  messages: Message[]
  role?: string
}

export interface Contact {
  id: string
  name: string
  initials: string
  role?: string
}

export interface BroadcastTarget {
  groupId: string
  groupName: string
  grade?: string
  section?: string
  recipientCount: number
}

interface ChatInterfaceProps {
  conversations: Conversation[]
  currentUserId: string
  userRole: "admin" | "profesor" | "familia"
  contacts?: Contact[]
  activeConversationId?: string | null
  canBroadcast?: boolean
  broadcastTargets?: BroadcastTarget[]
  onSendMessage?: (conversationId: string, message: string) => Promise<boolean> | boolean
  onOpenConversation?: (conversationId: string) => void
  onStartConversation?: (contactId: string) => void
  onBroadcast?: (groupId: string, body: string) => Promise<void> | void
}

export function ChatInterface({
  conversations: initialConversations,
  currentUserId,
  userRole,
  contacts = [],
  activeConversationId,
  canBroadcast = false,
  broadcastTargets = [],
  onSendMessage,
  onOpenConversation,
  onStartConversation,
  onBroadcast,
}: ChatInterfaceProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [contactQuery, setContactQuery] = useState("")
  const [newMode, setNewMode] = useState<"persona" | "grupo">("persona")
  const [selectedTarget, setSelectedTarget] = useState<BroadcastTarget | null>(null)
  const [broadcastBody, setBroadcastBody] = useState("")
  const [broadcasting, setBroadcasting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sincroniza con datos recargados desde el backend, preservando la selección actual.
  useEffect(() => {
    setConversations(initialConversations)
    setSelectedConversation((prev) =>
      prev ? initialConversations.find((c) => c.id === prev.id) ?? prev : null,
    )
  }, [initialConversations])

  // Permite que el contenedor seleccione una conversación (p. ej. al crearla).
  useEffect(() => {
    if (!activeConversationId) return
    const match = conversations.find((c) => c.id === activeConversationId)
    if (match) {
      setSelectedConversation(match)
      setShowMobileChat(true)
      setShowNewConversation(false)
    }
  }, [activeConversationId, conversations])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (selectedConversation) {
      scrollToBottom()
    }
    // Depende solo de .messages a propósito: si se depende del objeto completo,
    // cualquier otro cambio en selectedConversation (no solo mensajes nuevos)
    // dispararía un scroll no deseado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.messages])

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTime = (date: Date) => {
    // Comparar por día de calendario (medianoche a medianoche), no por
    // bloques de 24h desde "ahora": un mensaje de anoche 23:59 visto de
    // madrugada quedaba a menos de 24h y se mostraba como si fuera "hoy".
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    } else if (diffDays === 1) {
      return "Ayer"
    } else if (diffDays < 7) {
      return date.toLocaleDateString("es-ES", { weekday: "short" })
    } else {
      return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
    }
  }

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  }

  // Actualiza un mensaje (por id) dentro de una conversación, tanto en la
  // lista como en la conversación seleccionada, para reflejar su estado real
  // de envío (sending / failed) en vez de asumir "sent" sin confirmación.
  const updateMessage = (conversationId: string, messageId: string, patch: Partial<Message>) => {
    const apply = (messages: Message[]) =>
      messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m))

    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, messages: apply(c.messages) } : c))
    )
    setSelectedConversation((prev) =>
      prev && prev.id === conversationId ? { ...prev, messages: apply(prev.messages) } : prev
    )
  }

  const deliverMessage = async (conversationId: string, message: Message) => {
    updateMessage(conversationId, message.id, { status: "sending" })
    try {
      const ok = await onSendMessage?.(conversationId, message.content)
      updateMessage(conversationId, message.id, { status: ok === false ? "failed" : "sent" })
    } catch {
      updateMessage(conversationId, message.id, { status: "failed" })
    }
  }

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return

    const conversationId = selectedConversation.id
    const content = messageInput.trim()
    const newMessage: Message = {
      id: `pending-${Date.now()}`,
      content,
      timestamp: new Date(),
      sender: "user",
      status: "sending",
      type: "text",
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, newMessage],
              lastMessage: newMessage.content,
              lastMessageTime: newMessage.timestamp,
            }
          : c
      )
    )

    setSelectedConversation((prev) =>
      prev ? { ...prev, messages: [...prev.messages, newMessage], lastMessage: newMessage.content, lastMessageTime: newMessage.timestamp } : null
    )

    setMessageInput("")
    void deliverMessage(conversationId, newMessage)
  }

  const retryMessage = (message: Message) => {
    if (!selectedConversation) return
    void deliverMessage(selectedConversation.id, message)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setShowMobileChat(true)
    setShowNewConversation(false)
    // Marca como leído localmente y notifica al backend.
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversation.id ? { ...c, unreadCount: 0 } : c
      )
    )
    if (conversation.unreadCount > 0) {
      onOpenConversation?.(conversation.id)
    }
  }

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactQuery.toLowerCase())
  )

  const startConversation = (contactId: string) => {
    setContactQuery("")
    setShowNewConversation(false)
    onStartConversation?.(contactId)
  }

  const closeNewConversation = () => {
    setShowNewConversation(false)
    setNewMode("persona")
    setSelectedTarget(null)
    setBroadcastBody("")
    setContactQuery("")
  }

  const sendBroadcast = async () => {
    if (!selectedTarget || !broadcastBody.trim() || broadcasting) return
    setBroadcasting(true)
    try {
      await onBroadcast?.(selectedTarget.groupId, broadcastBody.trim())
      closeNewConversation()
    } finally {
      setBroadcasting(false)
    }
  }

  const MessageStatus = ({ status }: { status: Message["status"] }) => {
    if (status === "read") {
      return <CheckCheck className="h-4 w-4 text-blue-500" />
    } else if (status === "delivered") {
      return <CheckCheck className="h-4 w-4 text-muted-foreground" />
    } else if (status === "sending") {
      return <RotateCw className="h-3.5 w-3.5 animate-spin text-white/70" />
    } else if (status === "failed") {
      return <AlertCircle className="h-4 w-4 text-red-300" />
    }
    return <Check className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Conversation List - iOS Style */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-border bg-card lg:w-96",
          showMobileChat && "hidden lg:flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-xl font-semibold text-foreground">
            {showNewConversation ? "Nueva conversación" : "Mensajes"}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label={showNewConversation ? "Cerrar" : "Nueva conversación"}
              onClick={() =>
                showNewConversation ? closeNewConversation() : setShowNewConversation(true)
              }
            >
              <Plus
                className={cn("h-5 w-5 transition-transform", showNewConversation && "rotate-45")}
              />
            </Button>
          </div>
        </div>

        {showNewConversation ? (
          <>
            {canBroadcast && (
              <div className="flex gap-1 px-3 pt-3">
                <button
                  onClick={() => {
                    setNewMode("persona")
                    setSelectedTarget(null)
                  }}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    newMode === "persona"
                      ? "bg-blue-500 text-white"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  Persona
                </button>
                <button
                  onClick={() => setNewMode("grupo")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    newMode === "grupo"
                      ? "bg-blue-500 text-white"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  Grupo
                </button>
              </div>
            )}

            {newMode === "persona" ? (
              <>
                {/* Contact Picker (1:1) */}
                <div className="p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar contacto"
                      value={contactQuery}
                      onChange={(e) => setContactQuery(e.target.value)}
                      className="h-9 rounded-lg bg-secondary/50 pl-9 text-sm focus-visible:ring-1"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No hay contactos disponibles para iniciar una conversación.
                    </p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => startConversation(contact.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                            {contact.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground">{contact.name}</span>
                          {contact.role && (
                            <span className="block text-xs text-muted-foreground">{contact.role}</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : selectedTarget ? (
              <div className="flex flex-1 flex-col p-3">
                <button
                  onClick={() => setSelectedTarget(null)}
                  className="mb-2 flex items-center gap-1 text-sm text-blue-500"
                >
                  <ArrowLeft className="h-4 w-4" /> {selectedTarget.groupName}
                </button>
                <p className="mb-2 text-xs text-muted-foreground">
                  Se enviará como mensaje privado a {selectedTarget.recipientCount}{" "}
                  {selectedTarget.recipientCount === 1 ? "familia" : "familias"}. Cada acudiente
                  responde solo contigo, no ve a las demás.
                </p>
                <textarea
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Escribe el mensaje para las familias…"
                  className="min-h-[120px] flex-1 resize-none rounded-lg border border-border bg-secondary/30 p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  autoFocus
                />
                <Button
                  className="mt-3 w-full rounded-lg bg-blue-500 hover:bg-blue-600"
                  disabled={
                    !broadcastBody.trim() || broadcasting || selectedTarget.recipientCount === 0
                  }
                  onClick={sendBroadcast}
                >
                  {broadcasting
                    ? "Enviando…"
                    : `Enviar a ${selectedTarget.recipientCount} ${
                        selectedTarget.recipientCount === 1 ? "familia" : "familias"
                      }`}
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {broadcastTargets.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No tienes grupos disponibles para difundir.
                  </p>
                ) : (
                  broadcastTargets.map((target) => (
                    <button
                      key={target.groupId}
                      onClick={() => setSelectedTarget(target)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-medium text-white">
                          {(target.grade ?? "").slice(0, 1)}
                          {(target.section ?? "").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-foreground">{target.groupName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {target.recipientCount}{" "}
                          {target.recipientCount === 1 ? "familia" : "familias"}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Search - iOS Style */}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 rounded-lg bg-secondary/50 pl-9 text-sm focus-visible:ring-1"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aún no tienes conversaciones. Toca + para iniciar una.
                </p>
              ) : (
                filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => selectConversation(conversation)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50",
                selectedConversation?.id === conversation.id && "bg-secondary"
              )}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conversation.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                    {conversation.initials}
                  </AvatarFallback>
                </Avatar>
                {conversation.online && (
                  <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-green-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{conversation.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(conversation.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={cn(
                    "truncate text-sm",
                    conversation.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                  )}>
                    {conversation.typing ? (
                      <span className="text-blue-500">escribiendo...</span>
                    ) : (
                      conversation.lastMessage
                    )}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-medium text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                {conversation.role && (
                  <span className="text-xs text-muted-foreground">{conversation.role}</span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Chat Area - iOS Style */}
      <div
        className={cn(
          "flex flex-1 flex-col bg-background",
          !showMobileChat && "hidden lg:flex"
        )}
      >
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9"
                onClick={() => setShowMobileChat(false)}
              >
                <ArrowLeft className="h-5 w-5 text-blue-500" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedConversation.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                  {selectedConversation.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{selectedConversation.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.typing
                    ? "escribiendo..."
                    : selectedConversation.online
                    ? "en línea"
                    : "última vez hoy"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages - iOS Style Bubbles */}
            <div className="flex-1 overflow-y-auto p-4" style={{ 
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
            }}>
              <div className="space-y-3">
                {selectedConversation.messages.map((message, index) => {
                  const isUser = message.sender === "user"
                  const showAvatar = !isUser && (
                    index === 0 ||
                    selectedConversation.messages[index - 1]?.sender !== message.sender
                  )
                  const isLastInGroup = 
                    index === selectedConversation.messages.length - 1 ||
                    selectedConversation.messages[index + 1]?.sender !== message.sender

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-end gap-2",
                        isUser ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isUser && showAvatar && (
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-[10px]">
                            {selectedConversation.initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!isUser && !showAvatar && <div className="w-7" />}
                      <div className="flex max-w-[70%] flex-col items-end gap-1">
                        <div
                          className={cn(
                            "px-4 py-2 shadow-sm",
                            isUser
                              ? message.status === "failed"
                                ? "rounded-[20px] rounded-br-md bg-red-500/90 text-white"
                                : "rounded-[20px] rounded-br-md bg-blue-500 text-white"
                              : "rounded-[20px] rounded-bl-md bg-secondary text-foreground",
                            isLastInGroup && isUser && "rounded-br-[20px]",
                            isLastInGroup && !isUser && "rounded-bl-[20px]"
                          )}
                        >
                          <p className="text-[15px] leading-relaxed">{message.content}</p>
                          <div className={cn(
                            "mt-1 flex items-center justify-end gap-1",
                            isUser ? "text-white/70" : "text-muted-foreground"
                          )}>
                            <span className="text-[11px]">{formatMessageTime(message.timestamp)}</span>
                            {isUser && <MessageStatus status={message.status} />}
                          </div>
                        </div>
                        {isUser && message.status === "failed" && (
                          <button
                            onClick={() => retryMessage(message)}
                            className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:underline"
                          >
                            <RotateCw className="h-3 w-3" /> No se pudo enviar. Reintentar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input - iOS Style */}
            <div className="border-t border-border bg-card p-3">
              <div className="flex items-end gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-blue-500">
                  <Plus className="h-6 w-6" />
                </Button>
                <div className="relative flex-1">
                  <Input
                    placeholder="Mensaje"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="min-h-[36px] rounded-full bg-secondary/50 text-[15px] focus-visible:ring-1"
                  />
                </div>
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full bg-blue-500 hover:bg-blue-600"
                  disabled={!messageInput.trim()}
                  onClick={handleSendMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Send className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Tus mensajes</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecciona una conversación para comenzar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
