"use client"

import { ChatInterface, type Conversation } from "@/components/messages/chat-interface"

const mockConversations: Conversation[] = [
  {
    id: "1",
    name: "Prof. Juan López",
    initials: "JL",
    lastMessage: "Buenos días, ¿podemos agendar una reunión?",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5),
    unreadCount: 2,
    online: true,
    role: "Profesor - Matemáticas",
    messages: [
      {
        id: "1",
        content: "Hola, necesito hablar sobre el rendimiento de algunos estudiantes",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Claro, cuéntame qué sucede",
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "He notado que varios estudiantes de 5to A están teniendo dificultades con álgebra",
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "4",
        content: "Buenos días, ¿podemos agendar una reunión?",
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        sender: "other",
        status: "delivered",
        type: "text",
      },
    ],
  },
  {
    id: "2",
    name: "Familia García",
    initials: "FG",
    lastMessage: "Gracias por la información",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
    unreadCount: 0,
    online: false,
    role: "Padre de María García - 5to A",
    messages: [
      {
        id: "1",
        content: "Buenas tardes, quería consultar sobre las fechas de exámenes",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Hola, los exámenes finales serán del 15 al 22 de marzo",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "Gracias por la información",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
  {
    id: "3",
    name: "Prof. María Sánchez",
    initials: "MS",
    lastMessage: "El reporte ya está listo",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
    unreadCount: 1,
    online: true,
    typing: true,
    role: "Profesora - Lenguaje",
    messages: [
      {
        id: "1",
        content: "Hola, ¿ya terminaste el reporte de asistencia?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Sí, lo estoy revisando ahora",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "El reporte ya está listo",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "other",
        status: "delivered",
        type: "text",
      },
    ],
  },
  {
    id: "4",
    name: "Grupo: Coordinadores",
    initials: "GC",
    lastMessage: "Reunión confirmada para mañana",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unreadCount: 5,
    online: false,
    role: "5 participantes",
    messages: [
      {
        id: "1",
        content: "¿A qué hora es la reunión de mañana?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "A las 10:00 AM en la sala de conferencias",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 7),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "Perfecto, ahí estaré",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "4",
        content: "Reunión confirmada para mañana",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        sender: "other",
        status: "delivered",
        type: "text",
      },
    ],
  },
  {
    id: "5",
    name: "Familia Martínez",
    initials: "FM",
    lastMessage: "Carlos ha mejorado mucho, gracias",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
    unreadCount: 0,
    online: false,
    role: "Madre de Carlos Martínez - 5to A",
    messages: [
      {
        id: "1",
        content: "Le comento que Carlos tuvo algunas dificultades esta semana",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Entiendo, hablaré con él en casa",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 47),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "Carlos ha mejorado mucho, gracias",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
]

export default function AdminMensajesPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="p-4 lg:p-6">
          <ChatInterface
            conversations={mockConversations}
            currentUserId="admin-1"
            userRole="admin"
          />
        </div>
      </main>
    </div>
  )
}
