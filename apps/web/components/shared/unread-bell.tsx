"use client"

// Campanita con el contador real de no leídos (chat-tiempo-real.md, Fase 2 ítem 14).
//
// Antes los tres sidebars pintaban un punto rojo fijo: **siempre visible, incluso sin nada
// pendiente**. `GET /notifications/unread-count` existía desde el módulo de notificaciones y
// ningún archivo de `apps/web` lo llamaba.
//
// Vive en el header móvil. En escritorio ese header no se renderiza, así que el contador se
// muestra además en el ítem "Notificaciones" de la navegación (ver `NavUnreadBadge`).

import Link from "next/link"
import { Bell } from "lucide-react"
import { formatUnread, useUnreadCount } from "./use-unread-count"

interface Props {
  /** Ruta del centro de notificaciones del portal (cada uno tiene la suya). */
  href: string
  className?: string
}

export function UnreadBell({ href, className }: Props) {
  const count = useUnreadCount()

  return (
    <Link
      href={href}
      className={`relative rounded-md p-2 text-foreground ${className ?? ""}`}
      aria-label={count > 0 ? `Notificaciones: ${count} sin leer` : "Notificaciones"}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
          {formatUnread(count)}
        </span>
      )}
    </Link>
  )
}

/**
 * Badge para el ítem "Notificaciones" de la navegación lateral, que es **el único indicador
 * visible en escritorio**: el header con la campanita es `lg:hidden`.
 *
 * Con el sidebar colapsado no hay lugar para el número, así que se degrada a un punto.
 */
export function NavUnreadBadge({ collapsed }: { collapsed: boolean }) {
  const count = useUnreadCount()
  if (count === 0) return null

  if (collapsed) {
    return (
      <span
        aria-label={`${count} notificaciones sin leer`}
        className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive"
      />
    )
  }

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground">
      {formatUnread(count)}
    </span>
  )
}
