"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { io, Socket } from "socket.io-client"
import { toast } from "sonner"
import { AdminSidebar } from "@/components/admin/sidebar"
import { isImpersonating, exitImpersonation, getAccessToken, decodeJwt } from "@/lib/auth"
import { apiFetch } from "@/lib/api-client"
import { attachTokenRefresh } from "@/lib/socket"
import { API_URL } from "@/lib/env"
import { Button } from "@/components/ui/button"
import { AlertTriangle, LogOut } from "lucide-react"

const SCOPE_LABELS: Record<string, string> = {
  OPERATIVO: "operativo",
  DATOS_PERSONALES: "datos personales",
}

type ActiveAccessSession = {
  id: string
  scope: "OPERATIVO" | "DATOS_PERSONALES"
  status: "CONCEDIDO" | "EMERGENCIA"
  expiresAt: string | null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [impersonatorRole, setImpersonatorRole] = useState<string | null>(null)
  const [accessSession, setAccessSession] = useState<ActiveAccessSession | null>(null)
  const [expiredNotice, setExpiredNotice] = useState(false)
  const router = useRouter()

  const handleExit = useCallback(async () => {
    const { success, returnTo } = await exitImpersonation()
    if (success) {
      router.push(returnTo)
    }
  }, [router])

  useEffect(() => {
    const wasImpersonating = isImpersonating()
    setImpersonating(wasImpersonating)
    const jwt = getAccessToken()
    const decoded = jwt ? decodeJwt(jwt) : null
    setImpersonatorRole(decoded?.role ?? null)

    if (!wasImpersonating || !decoded?.ticketId) return
    const ticketId = decoded.ticketId

    // Se guarda fuera de React state (no hace falta re-render por esto) para
    // que el handler del socket, definido una sola vez más abajo, siempre lea
    // el id más reciente sin tener que reconectar el socket cada vez que
    // cambia.
    let currentSessionId: string | null = null

    apiFetch("/access-sessions/active", { silent: true })
      .then((res) => (res.ok ? res.json() : null))
      .then((session: ActiveAccessSession | null) => {
        currentSessionId = session?.id ?? null
        setAccessSession(session)
      })
      .catch(() => setAccessSession(null))

    // Tiempo real: se une al mismo room `ticket:${ticketId}` que ya usa el
    // chat del ticket (ver support.gateway.ts) para enterarse de inmediato
    // cuando el acceso expira, en vez de esperar al siguiente request para
    // que un guard lo bloquee.
    const token = getAccessToken()
    if (!token) return

    const socket: Socket = io(`${API_URL}/support`, {
      auth: { token },
      transports: ["websocket"],
    })
    attachTokenRefresh(socket)

    socket.on("connect", () => {
      socket.emit("ticket:join", { ticketId })
    })

    socket.on("access:expired", (payload: { ticketId: string; accessSessionId: string }) => {
      if (payload.ticketId !== ticketId) return
      // Si ya se concedió una sesión nueva para este mismo ticket después de
      // la que acaba de expirar, este evento es sobre la anterior y no aplica.
      if (currentSessionId && payload.accessSessionId !== currentSessionId) return

      setExpiredNotice(true)
      toast.error("Tu acceso de soporte a este colegio expiró.")
      void handleExit()
    })

    return () => {
      socket.emit("ticket:leave", { ticketId })
      socket.disconnect()
    }
  }, [handleExit])

  const bannerLabel = impersonatorRole === "SUPER_ADMIN"
    ? "Estás operando en modo Super Administrador dentro de este colegio."
    : "Estás operando temporalmente dentro de este colegio con acceso de soporte."

  const scopeSuffix = accessSession
    ? ` Alcance: ${SCOPE_LABELS[accessSession.scope]}${accessSession.status === "EMERGENCIA" ? " (emergencia)" : ""}${
        accessSession.expiresAt
          ? ` · expira ${new Date(accessSession.expiresAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`
          : ""
      }`
    : ""

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((c) => !c)} />
      {/* Mobile top bar offset */}
      <div className={`transition-all duration-300 lg:pt-0 pt-16 ${isCollapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        {impersonating && (
          <div
            className={`sticky top-0 z-30 flex items-center justify-between px-6 py-2.5 shadow-md ${
              expiredNotice ? "bg-red-500 text-red-50" : "bg-amber-500 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-5 w-5" />
              <span>{expiredNotice ? "Tu acceso expiró. Saliendo del colegio..." : `${bannerLabel}${scopeSuffix}`}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-amber-700 bg-amber-100 text-amber-900 hover:bg-amber-200"
              onClick={handleExit}
            >
              <LogOut className="h-4 w-4" />
              Volver al panel SaaS
            </Button>
          </div>
        )}
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
