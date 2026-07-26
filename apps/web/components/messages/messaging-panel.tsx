"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import {
  useConversationsSocket,
  useTypingEmitter,
  useTypingEvents,
  type IncomingMessage,
} from "@/lib/realtime"
import {
  ChatInterface,
  type BroadcastTarget,
  type Contact,
  type Conversation,
  type Message,
} from "@/components/messages/chat-interface"

type ApiParticipant = {
  id: string
  firstName: string
  lastName: string
  role: string | null
}

type ApiMessage = {
  id: string
  fromId: string
  body: string
  attachmentKey: string | null
  attachmentName: string | null
  createdAt: string
}

type ApiConversation = {
  id: string
  type: "DIRECT" | "GROUP"
  title: string | null
  participants: ApiParticipant[]
  otherParticipants: ApiParticipant[]
  unreadCount: number
  lastMessageAt: string
  messages: ApiMessage[]
}

type ApiContact = {
  id: string
  firstName: string
  lastName: string
  role: string
}

type ApiBroadcastTarget = {
  groupId: string
  groupName: string
  grade: string
  section: string
  recipientCount: number
}

function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "TEACHER":
      return "Profesor/a"
    case "GUARDIAN":
      return "Acudiente"
    case "STUDENT":
      return "Estudiante"
    case "TENANT_ADMIN":
    case "PRINCIPAL":
    case "COORDINATOR":
    case "SECRETARY":
      return "Administración"
    default:
      return ""
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function mapConversation(conversation: ApiConversation, currentUserId: string): Conversation {
  const other = conversation.otherParticipants[0]
  const name =
    conversation.type === "GROUP"
      ? conversation.title ?? "Grupo"
      : other
        ? `${other.firstName} ${other.lastName}`.trim()
        : "Conversación"

  const role =
    conversation.type === "GROUP"
      ? `${conversation.participants.length} participantes`
      : roleLabel(other?.role)

  const messages: Message[] = conversation.messages.map((message) => ({
    id: message.id,
    content: message.body,
    timestamp: new Date(message.createdAt),
    sender: message.fromId === currentUserId ? "user" : "other",
    status: "read",
    type: "text",
  }))

  const lastMessage = messages.length > 0 ? messages[messages.length - 1].content : ""

  return {
    id: conversation.id,
    name,
    initials: initialsOf(name),
    lastMessage,
    lastMessageTime: new Date(conversation.lastMessageAt),
    unreadCount: conversation.unreadCount,
    messages,
    role: role || undefined,
  }
}

function mapContact(contact: ApiContact): Contact {
  const name = `${contact.firstName} ${contact.lastName}`.trim()
  return {
    id: contact.id,
    name,
    initials: initialsOf(name),
    role: roleLabel(contact.role) || undefined,
  }
}

interface MessagingPanelProps {
  userRole: "admin" | "profesor" | "familia"
}

export function MessagingPanel({ userRole }: MessagingPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [broadcastTargets, setBroadcastTargets] = useState<BroadcastTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  // Hilos que ya llegaron a su primer mensaje: se deja de pedirles páginas anteriores. En un
  // ref y no en estado porque no cambia lo que se pinta.
  const exhaustedThreads = useRef<Set<string>>(new Set())

  const currentUserId = getCurrentUser()?.sub ?? ""
  const canBroadcast = userRole === "profesor" || userRole === "admin"

  const loadData = useCallback(async () => {
    try {
      const [conversationsRes, contactsRes, targetsRes] = await Promise.all([
        apiFetch("/conversations"),
        apiFetch("/conversations/contacts", { silent: true }),
        canBroadcast
          ? apiFetch("/conversations/broadcast/targets", { silent: true })
          : Promise.resolve(null),
      ])

      if (!conversationsRes.ok) {
        setError(true)
        return
      }

      const conversationsData = (await conversationsRes.json()) as ApiConversation[]
      setConversations(conversationsData.map((c) => mapConversation(c, currentUserId)))

      if (contactsRes.ok) {
        const contactsData = (await contactsRes.json()) as ApiContact[]
        setContacts(contactsData.map(mapContact))
      }

      if (targetsRes && targetsRes.ok) {
        const targetsData = (await targetsRes.json()) as ApiBroadcastTarget[]
        setBroadcastTargets(targetsData)
      }

      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [currentUserId, canBroadcast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  /**
   * Entrega en vivo. Lo importante es lo que **no** hace: no llama a `loadData()`.
   *
   * Recargar la bandeja entera con cada mensaje entrante convertiría "una consulta por tecla"
   * en "una consulta por mensaje de cualquier persona", que es peor. El mensaje llega completo
   * dentro del evento y se inserta en el hilo que corresponde.
   *
   * Se suscribe acá y no en `ChatInterface` porque este componente es el dueño de los datos;
   * `ChatInterface` sincroniza su copia local cuando cambia la prop.
   */
  const handleIncomingMessage = useCallback(
    ({ conversationId, message }: IncomingMessage) => {
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== conversationId) return conversation
          // Una reconexión puede reentregar algo ya visible: se deduplica por id.
          if (conversation.messages.some((existing) => existing.id === message.id)) {
            return conversation
          }

          const incoming: Message = {
            id: message.id,
            content: message.body,
            timestamp: new Date(message.createdAt),
            // El backend excluye al remitente de `recipientUserIds`, así que por socket solo
            // llega lo que escribió otro. La comparación queda igual por si eso cambia.
            sender: message.fromId === currentUserId ? "user" : "other",
            status: "read",
            type: "text",
          }

          return {
            ...conversation,
            messages: [...conversation.messages, incoming],
            lastMessage: incoming.content,
            lastMessageTime: incoming.timestamp,
            // Si el hilo está abierto, la persona lo está viendo: no se le suma un no leído.
            unreadCount:
              conversationId === activeConversationId
                ? conversation.unreadCount
                : conversation.unreadCount + 1,
          }
        }),
      )
    },
    [currentUserId, activeConversationId],
  )

  useConversationsSocket(handleIncomingMessage)

  /**
   * "Escribiendo..." del otro lado. El hueco ya existía en la UI (`conversation.typing`) y
   * nunca se seteaba: hasta ahora era un indicador decorativo.
   *
   * Se apaga solo a los 4 s aunque no llegue el `typing:stop`. Si se confiara solo en el stop,
   * cualquier corte de red o pestaña cerrada a mitad de frase dejaría al otro "escribiendo..."
   * indefinidamente — el margen es mayor que los 2 s del emisor para no parpadear mientras la
   * persona sigue tecleando.
   */
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const setTyping = useCallback((conversationId: string, typing: boolean) => {
    setConversations((current) =>
      current.map((c) => (c.id === conversationId ? { ...c, typing } : c)),
    )
  }, [])

  useTypingEvents(
    useCallback(
      ({ conversationId, isTyping }) => {
        const timers = typingTimers.current
        const pending = timers.get(conversationId)
        if (pending) clearTimeout(pending)

        setTyping(conversationId, isTyping)

        if (isTyping) {
          timers.set(
            conversationId,
            setTimeout(() => {
              setTyping(conversationId, false)
              timers.delete(conversationId)
            }, 4000),
          )
        } else {
          timers.delete(conversationId)
        }
      },
      [setTyping],
    ),
  )

  useEffect(() => {
    const timers = typingTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const emitTyping = useTypingEmitter()

  const handleSendMessage = useCallback(
    async (conversationId: string, message: string): Promise<boolean> => {
      try {
        const res = await apiFetch(`/conversations/${conversationId}/messages`, {
          method: "POST",
          body: JSON.stringify({ body: message }),
        })
        if (!res.ok) return false
        void loadData()
        return true
      } catch {
        return false
      }
    },
    [loadData],
  )

  /**
   * Antepone la página anterior del hilo. Devuelve si agregó algo.
   *
   * El cursor es el id del mensaje más viejo que ya está en pantalla; cuando el servidor
   * responde `nextCursor: null` se llegó al principio de la conversación y se deja de pedir.
   */
  const handleLoadOlderMessages = useCallback(
    async (conversationId: string): Promise<boolean> => {
      if (exhaustedThreads.current.has(conversationId)) return false

      const conversation = conversations.find((c) => c.id === conversationId)
      const oldest = conversation?.messages[0]
      if (!oldest) return false

      try {
        const res = await apiFetch(
          `/conversations/${conversationId}/messages?cursor=${encodeURIComponent(oldest.id)}`,
          { silent: true },
        )
        if (!res.ok) return false

        const data = (await res.json()) as { messages: ApiMessage[]; nextCursor: string | null }
        if (data.nextCursor === null) exhaustedThreads.current.add(conversationId)
        if (data.messages.length === 0) return false

        // El API devuelve del más nuevo al más viejo (así se pagina hacia atrás); la vista los
        // quiere al revés.
        const older: Message[] = data.messages
          .slice()
          .reverse()
          .map((message) => ({
            id: message.id,
            content: message.body,
            timestamp: new Date(message.createdAt),
            sender: message.fromId === currentUserId ? "user" : "other",
            status: "read",
            type: "text",
          }))

        setConversations((current) =>
          current.map((c) => {
            if (c.id !== conversationId) return c
            const known = new Set(c.messages.map((m) => m.id))
            const nuevos = older.filter((m) => !known.has(m.id))
            return nuevos.length > 0 ? { ...c, messages: [...nuevos, ...c.messages] } : c
          }),
        )
        return true
      } catch {
        return false
      }
    },
    [conversations, currentUserId],
  )

  const handleOpenConversation = useCallback(async (conversationId: string) => {
    await apiFetch(`/conversations/${conversationId}/read`, { method: "POST", silent: true })
  }, [])

  const handleStartConversation = useCallback(
    async (contactId: string) => {
      const res = await apiFetch("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantId: contactId }),
      })
      if (!res.ok) return
      const conversation = (await res.json()) as ApiConversation
      await loadData()
      setActiveConversationId(conversation.id)
    },
    [loadData],
  )

  const handleBroadcast = useCallback(
    async (groupId: string, body: string) => {
      const res = await apiFetch("/conversations/broadcast", {
        method: "POST",
        body: JSON.stringify({ groupId, body }),
      })
      if (!res.ok) return
      const result = (await res.json()) as { recipientCount: number }
      await loadData()
      toast.success(
        result.recipientCount === 1
          ? "Mensaje enviado a 1 familia"
          : `Mensaje enviado a ${result.recipientCount} familias`,
      )
    },
    [loadData],
  )

  return (
    <div className="p-4 lg:p-6 h-[calc(100vh-4rem)] lg:h-screen">
      {loading ? (
        <div className="flex h-full items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
          Cargando conversaciones…
        </div>
      ) : error ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">
            No se pudieron cargar las conversaciones.
          </p>
          <button
            onClick={() => {
              setLoading(true)
              void loadData()
            }}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <ChatInterface
          conversations={conversations}
          contacts={contacts}
          currentUserId={currentUserId}
          userRole={userRole}
          activeConversationId={activeConversationId}
          canBroadcast={canBroadcast}
          broadcastTargets={broadcastTargets}
          onSendMessage={handleSendMessage}
          onLoadOlderMessages={handleLoadOlderMessages}
          onTyping={emitTyping}
          onOpenConversation={handleOpenConversation}
          onStartConversation={handleStartConversation}
          onBroadcast={handleBroadcast}
        />
      )}
    </div>
  )
}
