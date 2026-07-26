"use client"

// Contador de notificaciones sin leer, vivo por socket.
//
// Se extrajo de UnreadBell cuando el mismo dato hizo falta en dos lugares: la campanita del
// header móvil y el ítem "Notificaciones" de la navegación, que es el único visible en
// escritorio. Con dos copias, cada una abriría su propio fetch y podrían mostrar números
// distintos en la misma pantalla.

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-client"
import { useNotificationPing } from "@/lib/realtime"

export function useUnreadCount(): number {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/notifications/unread-count", { silent: true })
      if (!res.ok) return
      const data = (await res.json()) as { count: number }
      setCount(data.count)
    } catch {
      // El contador no es crítico: si falla, se queda con el último valor conocido en vez de
      // romper el marco de toda la aplicación.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useNotificationPing(refresh)

  return count
}

/** "99+" a partir de cierto punto: un número de cuatro cifras rompe el layout del sidebar. */
export function formatUnread(count: number): string {
  return count > 99 ? "99+" : String(count)
}
