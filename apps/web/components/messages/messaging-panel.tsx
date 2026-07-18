"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
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
          onOpenConversation={handleOpenConversation}
          onStartConversation={handleStartConversation}
          onBroadcast={handleBroadcast}
        />
      )}
    </div>
  )
}
