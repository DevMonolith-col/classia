"use client"

// Conexión de tiempo real de la mensajería del colegio
// (docs/planning/chat-tiempo-real.md, Fase 2).
//
// Namespace propio (`/conversations`), separado del de soporte: son dos productos con
// audiencias distintas. La reconexión por token vencido la resuelve `attachTokenRefresh`, que
// ya existía para el chat de soporte.

import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { getAccessToken } from "./auth"
import { API_URL } from "./env"
import { attachTokenRefresh } from "./socket"

export type IncomingMessage = {
  conversationId: string
  message: {
    id: string
    fromId: string
    body: string
    attachmentKey: string | null
    attachmentName: string | null
    createdAt: string
  }
}

/**
 * Suscribe al usuario a los mensajes que le llegan y llama a `onMessage` con cada uno.
 *
 * El servidor emite a la sala `user:{id}`, en la que el gateway mete al socket al conectar, así
 * que acá no hay que unirse a nada ni declarar de qué conversaciones se quiere saber: llega lo
 * que a esta persona le corresponde, decidido por el backend.
 *
 * `onMessage` se guarda en un ref y **no va en las dependencias del efecto** a propósito: si
 * fuera dependencia, cada render con un callback nuevo cerraría y reabriría el socket, que es
 * la forma más común de romper esto sin darse cuenta.
 */
export function useConversationsSocket(onMessage: (event: IncomingMessage) => void) {
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const socket: Socket = io(`${API_URL}/conversations`, {
      auth: { token },
      // Sin fallback a long-polling: no hay sticky sessions en el proxy, y con más de una
      // réplica el polling se rompe.
      transports: ["websocket"],
    })

    attachTokenRefresh(socket)
    socket.on("message:new", (payload: IncomingMessage) => handlerRef.current(payload))

    return () => {
      socket.off("message:new")
      socket.disconnect()
    }
  }, [])
}
