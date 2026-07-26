"use client"

// Campanita con el contador real de no leídos (chat-tiempo-real.md, Fase 2 ítem 14).
//
// Antes los tres sidebars pintaban un punto rojo fijo: **siempre visible, incluso sin nada
// pendiente**. `GET /notifications/unread-count` existía desde el módulo de notificaciones y
// ningún archivo de `apps/web` lo llamaba.
//
// El contador se refresca por socket, así que sube solo cuando llega una nota, una tarea, una
// inasistencia, un comunicado, un evento o un mensaje — todo lo que pasa por
// `NotificationsService#notify`.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useNotificationPing } from "@/lib/realtime"

interface Props {
  /** Ruta del centro de notificaciones del portal (cada uno tiene la suya). */
  href: string
  className?: string
}

export function UnreadBell({ href, className }: Props) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/notifications/unread-count", { silent: true })
      if (!res.ok) return
      const data = (await res.json()) as { count: number }
      setCount(data.count)
    } catch {
      // La campanita no es crítica: si falla, se queda con el último valor conocido en vez de
      // mostrar un error en el marco de toda la aplicación.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useNotificationPing(refresh)

  return (
    <Link
      href={href}
      className={`relative rounded-md p-2 text-foreground ${className ?? ""}`}
      aria-label={count > 0 ? `Notificaciones: ${count} sin leer` : "Notificaciones"}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  )
}
