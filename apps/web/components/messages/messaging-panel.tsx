"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import {
  useConversationReadEvents,
  useConversationsSocket,
  usePresenceEvents,
  usePresenceHeartbeat,
  useTypingEmitter,
  useTypingEvents,
  type IncomingMessage,
} from "@/lib/realtime"
import {
  ChatInterface,
  messagePreview,
  type BroadcastTarget,
  type Contact,
  type Conversation,
  type Message,
  type MessageAttachment,
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
  /** Hasta cuándo leyeron los demás. Null = nadie abrió el hilo todavía. */
  otherLastReadAt: string | null
  online: boolean
  /** Avisos silenciados por quien consulta. */
  muted: boolean
  /** Null si nunca se lo vio conectado, o si es un hilo de grupo. */
  lastSeenAt: string | null
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

  const otherLastReadAt = conversation.otherLastReadAt
    ? new Date(conversation.otherLastReadAt)
    : null

  const messages: Message[] = conversation.messages.map((message) =>
    mapMessage(message, currentUserId, otherLastReadAt),
  )

  const lastMessage = messages.length > 0 ? messagePreview(messages[messages.length - 1]) : ""

  return {
    id: conversation.id,
    name,
    initials: initialsOf(name),
    lastMessage,
    lastMessageTime: new Date(conversation.lastMessageAt),
    unreadCount: conversation.unreadCount,
    otherLastReadAt,
    muted: conversation.muted,
    // Solo tiene sentido en un hilo directo: "en línea" de un grupo no significa nada.
    partnerId: conversation.otherParticipants.length === 1 ? conversation.otherParticipants[0].id : null,
    online: conversation.online,
    lastSeenAt: conversation.lastSeenAt ? new Date(conversation.lastSeenAt) : null,
    messages,
    role: role || undefined,
  }
}

/**
 * Traducción de un mensaje del API al de la vista. Es una sola función a propósito: los mensajes
 * entran por tres caminos distintos —el listado inicial, el socket y la paginación hacia atrás— y
 * mientras cada uno armaba su propio objeto, agregar un campo significaba acordarse de los tres.
 * Los adjuntos son justamente el campo que hacía falta.
 */
function mapMessage(
  message: ApiMessage,
  currentUserId: string,
  otherLastReadAt: Date | null,
): Message {
  const attachment =
    message.attachmentKey && message.attachmentName
      ? { key: message.attachmentKey, name: message.attachmentName }
      : null

  return {
    id: message.id,
    content: message.body,
    timestamp: new Date(message.createdAt),
    sender: message.fromId === currentUserId ? "user" : "other",
    status: readStatusOf(message, currentUserId, otherLastReadAt),
    attachment,
  }
}

/**
 * Estado real de un mensaje propio: leído si el otro abrió el hilo **después** de que se envió.
 *
 * Antes esto era el literal `"read"` para todos los mensajes, así que la UI mostraba los dos
 * checks azules siempre — incluso en un mensaje que el destinatario nunca abrió. El dato
 * necesario (`ConversationMember.lastReadAt`) ya existía en el modelo; solo faltaba exponerlo
 * y dejar de inventar.
 *
 * Para los mensajes ajenos el estado es indiferente: los checks solo se pintan en los propios.
 */
function readStatusOf(
  message: ApiMessage,
  currentUserId: string,
  otherLastReadAt: Date | null,
): Message["status"] {
  if (message.fromId !== currentUserId) return "read"
  if (!otherLastReadAt) return "delivered"
  return otherLastReadAt.getTime() >= new Date(message.createdAt).getTime() ? "read" : "delivered"
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

          // El backend excluye al remitente de `recipientUserIds`, así que por socket solo llega
          // lo que escribió otro; `mapMessage` igual resuelve el caso propio por si eso cambia.
          const incoming = mapMessage(message, currentUserId, conversation.otherLastReadAt ?? null)

          return {
            ...conversation,
            messages: [...conversation.messages, incoming],
            lastMessage: messagePreview(incoming),
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

  /**
   * El otro leyó: se recalculan los checks de los mensajes propios con el nuevo `lastReadAt`,
   * sin volver a pedir nada. Antes esto no existía y todo se veía leído desde siempre.
   */
  useConversationReadEvents(
    useCallback(
      ({ conversationId, lastReadAt }) => {
        const readAt = new Date(lastReadAt)
        setConversations((current) =>
          current.map((conversation) => {
            if (conversation.id !== conversationId) return conversation
            return {
              ...conversation,
              otherLastReadAt: readAt,
              messages: conversation.messages.map((message) =>
                message.sender === "user" && message.timestamp.getTime() <= readAt.getTime()
                  ? { ...message, status: "read" }
                  : message,
              ),
            }
          }),
        )
      },
      [],
    ),
  )

  usePresenceHeartbeat()

  usePresenceEvents(
    useCallback(({ userId, online, lastSeenAt }) => {
      setConversations((current) =>
        current.map((conversation) =>
          // La presencia es por persona, no por hilo: se aplica al hilo directo con ese usuario.
          conversation.partnerId === userId
            ? { ...conversation, online, lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : null }
            : conversation,
        ),
      )
    }, []),
  )

  const emitTyping = useTypingEmitter()

  const handleSendMessage = useCallback(
    async (
      conversationId: string,
      message: string,
      attachment?: MessageAttachment | null,
    ): Promise<boolean> => {
      try {
        const res = await apiFetch(`/conversations/${conversationId}/messages`, {
          method: "POST",
          body: JSON.stringify({
            body: message,
            ...(attachment
              ? { attachmentKey: attachment.key, attachmentName: attachment.name }
              : {}),
          }),
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
          .map((message) =>
            // Se pasa el `otherLastReadAt` del hilo en vez del literal "read" que había antes: un
            // mensaje propio viejo en un hilo que el otro nunca abrió no está leído.
            mapMessage(message, currentUserId, conversation.otherLastReadAt ?? null),
          )

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

  const handleToggleMute = useCallback(async (conversationId: string, muted: boolean) => {
    // Optimista: el toggle tiene que responder al toque, y si el POST falla se revierte. No hay
    // nada que perder si sale mal, a diferencia de un mensaje.
    setConversations((current) =>
      current.map((c) => (c.id === conversationId ? { ...c, muted } : c)),
    )

    const res = await apiFetch(`/conversations/${conversationId}/mute`, {
      method: "POST",
      body: JSON.stringify({ muted }),
      silent: true,
    })

    if (!res.ok) {
      setConversations((current) =>
        current.map((c) => (c.id === conversationId ? { ...c, muted: !muted } : c)),
      )
      toast.error("No se pudo cambiar el silencio de la conversación.")
    }
  }, [])

  /**
   * Al entrar a un hilo: marca como leído (si hacía falta) y trae el historial
   * reciente completo (hasta 50 mensajes) vía GET /conversations/:id/messages.
   *
   * GET /conversations (la bandeja) ahora solo trae el último mensaje de cada
   * hilo para el snippet -- ver conversations.service.ts#LIST_SNIPPET_SIZE,
   * backlog "Rendimiento y Escalabilidad" punto 1.1 -- así que sin este fetch
   * el chat se abriría mostrando un único mensaje.
   */
  const handleOpenConversation = useCallback(
    async (conversationId: string) => {
      const conversation = conversations.find((c) => c.id === conversationId)
      if (conversation && conversation.unreadCount > 0) {
        void apiFetch(`/conversations/${conversationId}/read`, { method: "POST", silent: true })
      }

      try {
        const res = await apiFetch(`/conversations/${conversationId}/messages`, { silent: true })
        if (!res.ok) return

        const data = (await res.json()) as { messages: ApiMessage[]; nextCursor: string | null }
        if (data.nextCursor === null) exhaustedThreads.current.add(conversationId)
        else exhaustedThreads.current.delete(conversationId)

        // El API devuelve del más nuevo al más viejo (así se pagina hacia atrás); la vista los
        // quiere al revés -- mismo mapeo que handleLoadOlderMessages.
        const recent: Message[] = data.messages
          .slice()
          .reverse()
          .map((message) =>
            mapMessage(message, currentUserId, conversation?.otherLastReadAt ?? null),
          )

        setConversations((current) =>
          current.map((c) => (c.id === conversationId ? { ...c, messages: recent } : c)),
        )
      } catch {
        // Silencioso: si falla, el usuario sigue viendo el último mensaje que ya
        // traía el listado en vez de quedar con el chat vacío.
      }
    },
    [conversations, currentUserId],
  )

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
          onToggleMute={handleToggleMute}
          onOpenConversation={handleOpenConversation}
          onStartConversation={handleStartConversation}
          onBroadcast={handleBroadcast}
        />
      )}
    </div>
  )
}
