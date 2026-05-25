"use client"

import { ChatInterface, type Conversation } from "@/components/messages/chat-interface"

const mockConversations: Conversation[] = [
  {
    id: "1",
    name: "Prof. Juan López",
    initials: "JL",
    lastMessage: "María va muy bien en matemáticas",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 15),
    unreadCount: 1,
    online: true,
    role: "Profesor de Matemáticas - 5to A",
    messages: [
      {
        id: "1",
        content: "Buenos días profesor, quería saber cómo va María",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Buenos días, María ha mejorado mucho este trimestre",
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "Su última evaluación fue excelente, sacó 19/20",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "4",
        content: "María va muy bien en matemáticas",
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        sender: "other",
        status: "delivered",
        type: "text",
      },
    ],
  },
  {
    id: "2",
    name: "Prof. María Sánchez",
    initials: "MS",
    lastMessage: "La tarea es para el viernes",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
    unreadCount: 0,
    online: false,
    role: "Profesora de Lenguaje - 5to A",
    messages: [
      {
        id: "1",
        content: "Buenas tardes profesora, ¿cuándo es la entrega del proyecto?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "La tarea es para el viernes",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
  {
    id: "3",
    name: "Administración",
    initials: "AD",
    lastMessage: "Recuerde el pago de mensualidad",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unreadCount: 2,
    online: true,
    role: "Secretaría",
    messages: [
      {
        id: "1",
        content: "Estimada familia, les recordamos que la fecha límite de pago es el 15",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Gracias por el recordatorio",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "Recuerde el pago de mensualidad",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        sender: "other",
        status: "delivered",
        type: "text",
      },
    ],
  },
  {
    id: "4",
    name: "Grupo: Padres 5to A",
    initials: "5A",
    lastMessage: "¿Quién lleva la piñata?",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 8),
    unreadCount: 12,
    online: false,
    role: "28 participantes",
    messages: [
      {
        id: "1",
        content: "Buenos días padres, estamos organizando la celebración del día del niño",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Nosotros podemos llevar los refrescos",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "¿Quién lleva la piñata?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
  {
    id: "5",
    name: "Prof. Roberto Díaz",
    initials: "RD",
    lastMessage: "Pedro necesita refuerzo en ciencias",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 48),
    unreadCount: 0,
    online: false,
    role: "Profesor de Ciencias - 3ro B",
    messages: [
      {
        id: "1",
        content: "Buenas tardes, quería hablarle sobre Pedro",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Claro profesor, dígame",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 49),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "Pedro necesita refuerzo en ciencias",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
]

export default function FamiliaMensajesPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="p-4 lg:p-6">
          <ChatInterface
            conversations={mockConversations}
            currentUserId="familia-1"
            userRole="familia"
          />
        </div>
      </main>
    </div>
  )
}
