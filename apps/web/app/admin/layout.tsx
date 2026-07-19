"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminSidebar } from "@/components/admin/sidebar"
import { isImpersonating, exitImpersonation, getAccessToken, decodeJwt } from "@/lib/auth"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { AlertTriangle, LogOut } from "lucide-react"

const SCOPE_LABELS: Record<string, string> = {
  OPERATIVO: "operativo",
  DATOS_PERSONALES: "datos personales",
}

type ActiveAccessSession = {
  scope: "OPERATIVO" | "DATOS_PERSONALES"
  status: "CONCEDIDO" | "EMERGENCIA"
  expiresAt: string | null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [impersonatorRole, setImpersonatorRole] = useState<string | null>(null)
  const [accessSession, setAccessSession] = useState<ActiveAccessSession | null>(null)
  const router = useRouter()

  useEffect(() => {
    const wasImpersonating = isImpersonating()
    setImpersonating(wasImpersonating)
    const jwt = getAccessToken()
    setImpersonatorRole(jwt ? decodeJwt(jwt)?.role ?? null : null)
    if (wasImpersonating) {
      apiFetch("/access-sessions/active", { silent: true })
        .then((res) => (res.ok ? res.json() : null))
        .then(setAccessSession)
        .catch(() => setAccessSession(null))
    }
  }, [])

  const handleExit = async () => {
    const { success, returnTo } = await exitImpersonation()
    if (success) {
      router.push(returnTo)
    }
  }

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
          <div className="sticky top-0 z-30 flex items-center justify-between bg-amber-500 px-6 py-2.5 text-amber-950 shadow-md">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-5 w-5" />
              <span>{bannerLabel}{scopeSuffix}</span>
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
