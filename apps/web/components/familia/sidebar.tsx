"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Home, BookOpen, ClipboardList, Calendar, CalendarDays,
  MessageSquare, FileText, Bell, Settings, FileCheck2,
  Megaphone, Wallet,
} from "lucide-react"
import { logout, getStoredUser } from "@/lib/auth"
import { NavUnreadBadge, UnreadBell } from "@/components/shared/unread-bell"
import { PortalSidebar } from "@/components/shared/portal-sidebar"

const ROLE_LABELS: Record<string, string> = {
  GUARDIAN: "Acudiente",
  STUDENT:  "Estudiante",
}

const navigation = [
  { name: "Inicio",          href: "/familia",               icon: Home },
  { name: "Calificaciones",  href: "/familia/calificaciones",icon: ClipboardList },
  { name: "Tareas",          href: "/familia/tareas",        icon: FileText },
  { name: "Calendario",      href: "/familia/calendario",    icon: CalendarDays },
  { name: "Horario",         href: "/familia/horario",       icon: Calendar },
  { name: "Asistencia",      href: "/familia/asistencia",    icon: BookOpen },
  // "Estado de cuenta" y no "Pagos": la pantalla muestra cartera, no cobra. Un rótulo que
  // promete pagar manda a la familia a buscar un botón que no existe ni va a existir acá.
  { name: "Estado de cuenta", href: "/familia/pagos",        icon: Wallet },
  { name: "Certificados",    href: "/familia/certificados",  icon: FileCheck2 },
  { name: "Mensajes",        href: "/familia/mensajes",      icon: MessageSquare },
  { name: "Comunicados",     href: "/familia/comunicados",   icon: Megaphone },
  { name: "Notificaciones",  href: "/familia/notificaciones",icon: Bell },
  { name: "Ajustes",         href: "/familia/ajustes",       icon: Settings },
]

interface Props { isCollapsed: boolean; onToggle: () => void }

export function FamiliaSidebar({ isCollapsed, onToggle }: Props) {
  const pathname     = usePathname()
  const router       = useRouter()
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string } | null>(null)

  useEffect(() => { setUser(getStoredUser()) }, [])

  const initials    = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "FA"
  const displayName = user ? `${user.firstName} ${user.lastName}` : "Familia"
  const roleLabel   = user ? (ROLE_LABELS[user.role] ?? user.role) : ""

  const handleLogout = async () => { await logout(); router.push("/login") }

  return (
    <PortalSidebar
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      brandInitial="C"
      brandName="Classia"
      mobileTopBarRightSlot={<UnreadBell href="/familia/notificaciones" />}
      initials={initials}
      displayName={displayName}
      roleLabel={roleLabel}
      onLogout={handleLogout}
      showUserInfo={!!user}
    >
      {(closeMobileMenu) => (
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navigation.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={closeMobileMenu}
                title={isCollapsed ? item.name : undefined}
                className={[
                  "relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                  isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                ].join(" ")}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
                {/* Unico indicador de no leidos en escritorio: el header con la campanita
                    es lg:hidden. */}
                {item.href.endsWith("/notificaciones") && (
                  <NavUnreadBadge collapsed={isCollapsed} />
                )}
              </Link>
            )
          })}
        </nav>
      )}
    </PortalSidebar>
  )
}
