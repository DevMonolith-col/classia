"use client"

// Conexión de tiempo real de la mensajería y las notificaciones del colegio
// (docs/planning/chat-tiempo-real.md, Fases 1-2).
//
// **Un solo socket por pestaña**, compartido por todos los consumidores. Importa: el panel de
// mensajes y la campanita de cada sidebar viven en el mismo árbol, y una conexión por hook
// serían dos WebSockets por usuario haciendo el mismo trabajo. El socket se abre con el primer
// suscriptor y se cierra cuando se va el último.
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

let shared: Socket | null = null
let subscribers = 0
let teardownTimer: ReturnType<typeof setTimeout> | null = null

function acquire(): Socket | null {
  // React en modo estricto monta, desmonta y vuelve a montar: sin este cancelamiento, cada
  // pantalla abriría y cerraría el socket una vez de más en desarrollo.
  if (teardownTimer) {
    clearTimeout(teardownTimer)
    teardownTimer = null
  }

  subscribers += 1
  if (shared) return shared

  const token = getAccessToken()
  if (!token) {
    subscribers -= 1
    return null
  }

  shared = io(`${API_URL}/conversations`, {
    auth: { token },
    // Sin fallback a long-polling: no hay sticky sessions en el proxy, y con más de una
    // réplica el polling se rompe.
    transports: ["websocket"],
  })
  attachTokenRefresh(shared)
  return shared
}

function release() {
  subscribers = Math.max(0, subscribers - 1)
  if (subscribers > 0 || !shared) return

  // Margen corto antes de cerrar, por el desmontaje/remontaje del modo estricto y por las
  // navegaciones entre páginas que reusan la misma conexión.
  teardownTimer = setTimeout(() => {
    if (subscribers === 0 && shared) {
      shared.disconnect()
      shared = null
    }
    teardownTimer = null
  }, 1000)
}

/**
 * Suscribe un handler a un evento del socket compartido.
 *
 * `handler` se guarda en un ref y **no va en las dependencias del efecto** a propósito: si
 * fuera dependencia, cada render con un callback nuevo cerraría y reabriría la suscripción,
 * que es la forma más común de romper esto sin darse cuenta.
 */
export function useRealtimeEvent<T>(event: string, handler: (payload: T) => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const socket = acquire()
    if (!socket) return

    const listener = (payload: T) => handlerRef.current(payload)
    socket.on(event, listener)

    return () => {
      socket.off(event, listener)
      release()
    }
  }, [event])
}

/** Mensajes que le llegan a esta persona. El servidor ya decidió cuáles le corresponden. */
export function useConversationsSocket(onMessage: (event: IncomingMessage) => void) {
  useRealtimeEvent<IncomingMessage>("message:new", onMessage)
}

/**
 * Avisa que el contador de no leídos cambió. Sin payload: el número se vuelve a pedir a la
 * API, que es la única fuente de verdad.
 */
export function useNotificationPing(onPing: () => void) {
  useRealtimeEvent<void>("notification:new", onPing)
}

export type PresenceEvent = {
  userId: string
  online: boolean
  lastSeenAt: string | null
}

/** Conexiones y desconexiones de la gente con la que esta persona conversa. */
export function usePresenceEvents(onPresence: (event: PresenceEvent) => void) {
  useRealtimeEvent<PresenceEvent>("presence:changed", onPresence)
}

/**
 * Late cada 30 s para que el servidor sepa que esta pestaña sigue viva.
 *
 * Es lo único que apaga a alguien que se fue sin cerrar sesión —cerró la laptop, perdió la
 * red—: el `disconnect` limpio no llega nunca en esos casos y, sin el latido, esa persona
 * queda "en línea" para siempre del otro lado.
 */
export function usePresenceHeartbeat() {
  useEffect(() => {
    const socket = acquire()
    if (!socket) return

    const beat = () => socket.emit("presence:heartbeat")
    beat()
    const interval = setInterval(beat, 30_000)

    return () => {
      clearInterval(interval)
      release()
    }
  }, [])
}

export type ConversationReadEvent = {
  conversationId: string
  userId: string
  lastReadAt: string
}

/** El otro abrió el hilo: los checks de los mensajes propios pasan a azul. */
export function useConversationReadEvents(onRead: (event: ConversationReadEvent) => void) {
  useRealtimeEvent<ConversationReadEvent>("conversation:read", onRead)
}

export type TypingEvent = {
  conversationId: string
  userId: string
  isTyping: boolean
}

/** Avisos de "escribiendo..." de los hilos en los que participa esta persona. */
export function useTypingEvents(onTyping: (event: TypingEvent) => void) {
  useRealtimeEvent<TypingEvent>("typing", onTyping)
}

/**
 * Emisor de "escribiendo..." con corte automático.
 *
 * Dos cosas que evitan inundar el socket: solo se manda `typing:start` en el primer tecleo de
 * una ráfaga (no en cada letra), y siempre se programa un `typing:stop` a los 2 s. Sin ese
 * corte, quien escribe una frase y se va a hacer otra cosa queda "escribiendo..." para siempre
 * del otro lado.
 */
export function useTypingEmitter() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (conversationId: string) => {
    const socket = shared
    if (!socket) return

    if (activeRef.current !== conversationId) {
      socket.emit("typing:start", { conversationId })
      activeRef.current = conversationId
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId })
      activeRef.current = null
      timerRef.current = null
    }, 2000)
  }
}
