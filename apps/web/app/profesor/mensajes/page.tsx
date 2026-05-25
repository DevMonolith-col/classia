"use client"

import { ChatInterface, type Conversation } from "@/components/messages/chat-interface"

const mockConversations: Conversation[] = [
  {
    id: "1",
    name: "Administración",
    initials: "AD",
    lastMessage: "La reunión será mañana a las 10:00",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 10),
    unreadCount: 1,
    online: true,
    role: "Coordinación Académica",
    messages: [
      {
        id: "1",
        content: "Buenos días profesor, necesitamos coordinar las fechas de exámenes",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Claro, tengo disponibilidad del 15 al 22",
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "La reunión será mañana a las 10:00",
        timestamp: new Date(Date.now() - 1000 * 60 * 10),
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
    lastMessage: "Muchas gracias por la información, profesor",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
    unreadCount: 0,
    online: false,
    role: "Padre de Ana García - 5to A",
    messages: [
      {
        id: "1",
        content: "Buenas tardes profesor, quería saber cómo va Ana en matemáticas",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Ana va muy bien, ha mejorado bastante en álgebra",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "Su última prueba fue de 18/20, muy buen resultado",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "4",
        content: "Muchas gracias por la información, profesor",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
  {
    id: "3",
    name: "Familia Martínez",
    initials: "FM",
    lastMessage: "¿Podemos hablar sobre Carlos?",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60),
    unreadCount: 2,
    online: true,
    typing: true,
    role: "Madre de Carlos Martínez - 5to A",
    messages: [
      {
        id: "1",
        content: "Hola profesor, espero que se encuentre bien",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "¿Podemos hablar sobre Carlos?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        sender: "other",
        status: "delivered",
        type: "text",
      },
    ],
  },
  {
    id: "4",
    name: "Grupo: Profesores 5to",
    initials: "P5",
    lastMessage: "Prof. Sánchez: Confirmo mi asistencia",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 3),
    unreadCount: 0,
    online: false,
    role: "8 participantes",
    messages: [
      {
        id: "1",
        content: "Recuerden que la reunión de coordinación es el viernes",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        sender: "user",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Prof. Sánchez: Confirmo mi asistencia",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
  {
    id: "5",
    name: "Familia Pérez",
    initials: "FP",
    lastMessage: "Diana llegará tarde mañana",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
    unreadCount: 0,
    online: false,
    role: "Padre de Diana Pérez - 5to A",
    messages: [
      {
        id: "1",
        content: "Buenos días profesor",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25),
        sender: "other",
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "Diana llegará tarde mañana por una cita médica",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        sender: "other",
        status: "read",
        type: "text",
      },
    ],
  },
]

export default function ProfesorMensajesPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="p-4 lg:p-6">
          <ChatInterface
            conversations={mockConversations}
            currentUserId="profesor-1"
            userRole="profesor"
          />
        </div>
      </main>
    </div>
  )
}
