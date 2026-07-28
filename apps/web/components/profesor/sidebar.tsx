"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard, Users, BookOpen, Calendar, CalendarDays,
  FileText, ClipboardList, MessageSquare, Settings,
  Bell, ClipboardCheck, Megaphone,
} from "lucide-react"
import { logout, getStoredUser } from "@/lib/auth"
import { NavUnreadBadge, UnreadBell } from "@/components/shared/unread-bell"
import { PortalSidebar } from "@/components/shared/portal-sidebar"

const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Docente",
  COORDINATOR: "Coordinador",
  PRINCIPAL: "Rector",
}

const navigation = [
  { name: "Mi Panel",       href: "/profesor",               icon: LayoutDashboard },
  { name: "Mis Clases",     href: "/profesor/clases",        icon: BookOpen },
  { name: "Estudiantes",    href: "/profesor/estudiantes",   icon: Users },
  { name: "Calificaciones", href: "/profesor/calificaciones",icon: ClipboardList },
  { name: "Asignaciones",   href: "/profesor/asignaciones",  icon: FileText },
  { name: "Asistencia",     href: "/profesor/asistencia",    icon: ClipboardCheck },
  { name: "Calendario",     href: "/profesor/calendario",    icon: CalendarDays },
  { name: "Horario",        href: "/profesor/horario",       icon: Calendar },
  { name: "Mensajes",       href: "/profesor/mensajes",      icon: MessageSquare },
  { name: "Comunicados",    href: "/profesor/comunicados",   icon: Megaphone },
  { name: "Notificaciones", href: "/profesor/notificaciones",icon: Bell },
  { name: "Configuración",  href: "/profesor/configuracion", icon: Settings },
]

interface Props { isCollapsed: boolean; onToggle: () => void }

export function ProfesorSidebar({ isCollapsed, onToggle }: Props) {
  const pathname     = usePathname()
  const router       = useRouter()
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string } | null>(null)

  useEffect(() => { setUser(getStoredUser()) }, [])

  const initials    = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "PR"
  const displayName = user ? `${user.firstName} ${user.lastName}` : "Profesor"
  const roleLabel   = user ? (ROLE_LABELS[user.role] ?? user.role) : ""

  const handleLogout = async () => { await logout(); router.push("/login") }

  return (
    <PortalSidebar
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      brandInitial="C"
      brandName="Classia"
      mobileTopBarRightSlot={<UnreadBell href="/profesor/notificaciones" />}
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
