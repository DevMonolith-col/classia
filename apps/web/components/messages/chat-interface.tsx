"use client"

import { useState, useRef, useEffect } from "react"
import {
  Search,
  Plus,
  Phone,
  Video,
  MoreHorizontal,
  Send,
  Image as ImageIcon,
  Paperclip,
  Mic,
  ArrowLeft,
  Check,
  CheckCheck,
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
  status: "sent" | "delivered" | "read"
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

interface ChatInterfaceProps {
  conversations: Conversation[]
  currentUserId: string
  userRole: "admin" | "profesor" | "familia"
  onSendMessage?: (conversationId: string, message: string) => void
}

export function ChatInterface({
  conversations: initialConversations,
  currentUserId,
  userRole,
  onSendMessage,
}: ChatInterfaceProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [showMobileChat, setShowMobileChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (selectedConversation) {
      scrollToBottom()
    }
  }, [selectedConversation?.messages])

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
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

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageInput.trim(),
      timestamp: new Date(),
      sender: "user",
      status: "sent",
      type: "text",
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
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
    onSendMessage?.(selectedConversation.id, messageInput.trim())
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
    // Mark as read
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversation.id ? { ...c, unreadCount: 0 } : c
      )
    )
  }

  const MessageStatus = ({ status }: { status: Message["status"] }) => {
    if (status === "read") {
      return <CheckCheck className="h-4 w-4 text-blue-500" />
    } else if (status === "delivered") {
      return <CheckCheck className="h-4 w-4 text-muted-foreground" />
    }
    return <Check className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Conversation List - iOS Style */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-border bg-card lg:w-96",
          showMobileChat && "hidden lg:flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-xl font-semibold text-foreground">Mensajes</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

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
          {filteredConversations.map((conversation) => (
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
          ))}
        </div>
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
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-blue-500">
                  <Video className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-blue-500">
                  <Phone className="h-5 w-5" />
                </Button>
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
                      <div
                        className={cn(
                          "max-w-[70%] px-4 py-2 shadow-sm",
                          isUser
                            ? "rounded-[20px] rounded-br-md bg-blue-500 text-white"
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
                    className="min-h-[36px] rounded-full bg-secondary/50 pr-10 text-[15px] focus-visible:ring-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                </div>
                {messageInput.trim() ? (
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full bg-blue-500 hover:bg-blue-600"
                    onClick={handleSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-blue-500">
                    <Mic className="h-6 w-6" />
                  </Button>
                )}
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
