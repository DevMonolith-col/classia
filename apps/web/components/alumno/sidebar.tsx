"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Home, ClipboardList, FileText, Vote, FileCheck2, CalendarDays, Calendar,
} from "lucide-react"
import { logout, getStoredUser } from "@/lib/auth"
import { PortalSidebar } from "@/components/shared/portal-sidebar"

const navigation = [
  { name: "Mi Panel",       href: "/alumno",               icon: Home },
  { name: "Asignaciones",   href: "/alumno/asignaciones",  icon: FileText },
  { name: "Calendario",     href: "/alumno/calendario",    icon: CalendarDays },
  { name: "Horario",        href: "/alumno/horario",       icon: Calendar },
  { name: "Calificaciones", href: "/alumno/calificaciones",icon: ClipboardList },
  { name: "Votación",       href: "/alumno/votacion",      icon: Vote },
  { name: "Certificados",   href: "/alumno/certificados",  icon: FileCheck2 },
]

interface Props { isCollapsed: boolean; onToggle: () => void }

export function AlumnoSidebar({ isCollapsed, onToggle }: Props) {
  const pathname     = usePathname()
  const router       = useRouter()
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string } | null>(null)

  useEffect(() => { setUser(getStoredUser()) }, [])

  const initials    = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "ES"
  const displayName = user ? `${user.firstName} ${user.lastName}` : "Estudiante"

  const handleLogout = async () => { await logout(); router.push("/login") }

  return (
    <PortalSidebar
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      brandInitial="C"
      brandName="Classia"
      initials={initials}
      displayName={displayName}
      roleLabel="Estudiante"
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
                  "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                  isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                ].join(" ")}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            )
          })}
        </nav>
      )}
    </PortalSidebar>
  )
}
