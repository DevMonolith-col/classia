"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  MessageSquare, BarChart3, Settings,
  Bell, FileText, ClipboardCheck, ClipboardList, Puzzle, CalendarClock, Megaphone, SlidersHorizontal, LifeBuoy, ChevronDown,
  UserCog, School, BookMarked, Mail, Briefcase, Vote, FileCheck2, Wallet, UploadCloud, History
} from "lucide-react"
import { logout, getStoredUser } from "@/lib/auth"
import { NavUnreadBadge, UnreadBell } from "@/components/shared/unread-bell"
import { PortalSidebar } from "@/components/shared/portal-sidebar"

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  SUPPORT_SUPERVISOR: "Supervisor de Soporte",
  SUPPORT_AGENT: "Soporte",
  TENANT_ADMIN: "Administrador",
  PRINCIPAL: "Rector",
  COORDINATOR: "Coordinador",
  SECRETARY: "Secretaria",
}

type NavItem = {
  name: string;
  href?: string;
  icon: any;
  // `soon`: la pantalla existe y se puede abrir, pero explica que la función
  // todavía no está — no es un enlace muerto ni una sección deshabilitada.
  // Mismo criterio que el badge "Pronto" del sidebar de superadmin.
  children?: { name: string; href: string; icon: any; soon?: boolean }[];
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    name: "Comunidad",
    icon: Users,
    children: [
      { name: "Estudiantes", href: "/admin/estudiantes", icon: GraduationCap },
      { name: "Profesores", href: "/admin/profesores", icon: UserCog },
      { name: "Onboarding masivo", href: "/admin/onboarding", icon: UploadCloud },
    ]
  },
  {
    name: "Académico",
    icon: BookOpen,
    children: [
      { name: "Cursos", href: "/admin/cursos", icon: School },
      { name: "Materias", href: "/admin/materias", icon: BookMarked },
      { name: "Horarios", href: "/admin/horarios", icon: CalendarClock },
      { name: "Asignaciones", href: "/admin/asignaciones", icon: FileText },
      { name: "Asistencia", href: "/admin/asistencia", icon: ClipboardCheck },
      { name: "Calificaciones", href: "/admin/calificaciones", icon: ClipboardList },
      { name: "Config. Académica", href: "/admin/configuracion-academica", icon: SlidersHorizontal },
    ]
  },
  {
    name: "Comunicación",
    icon: MessageSquare,
    children: [
      { name: "Mensajes", href: "/admin/mensajes", icon: Mail },
      { name: "Comunicados", href: "/admin/comunicados", icon: Megaphone },
      { name: "Notificaciones", href: "/admin/notificaciones", icon: Bell },
      { name: "Calendario", href: "/admin/calendario", icon: Calendar },
    ]
  },
  {
    name: "Administración",
    icon: Briefcase,
    children: [
      { name: "Reportes", href: "/admin/reportes", icon: BarChart3 },
      { name: "Pagos", href: "/admin/pagos", icon: Wallet },
      { name: "Gobierno Escolar", href: "/admin/elecciones", icon: Vote },
      { name: "Certificados", href: "/admin/certificados", icon: FileCheck2 },
      { name: "Actividad", href: "/admin/actividad", icon: History },
      { name: "Soporte", href: "/admin/soporte", icon: LifeBuoy },
      { name: "Plugins", href: "/admin/plugins", icon: Puzzle, soon: true },
      { name: "Configuración", href: "/admin/configuracion", icon: Settings },
    ]
  }
]

interface Props { isCollapsed: boolean; onToggle: () => void }

export function AdminSidebar({ isCollapsed, onToggle }: Props) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "Académico": false,
    "Comunidad": false,
    "Comunicación": false,
    "Administración": false,
  })
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string; tenantName?: string } | null>(null)

  useEffect(() => { setUser(getStoredUser()) }, [])

  // Auto-expand category if active pathname is inside it
  useEffect(() => {
    navigation.forEach(item => {
      if (item.children && item.children.some(child => pathname === child.href || pathname.startsWith(`${child.href}/`))) {
        setExpanded(prev => ({ ...prev, [item.name]: true }))
      }
    })
  }, [pathname])

  const toggleCategory = (name: string) => {
    if (isCollapsed) onToggle() // Expand sidebar if collapsed
    else setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const initials     = user?.firstName ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase() : "AD"
  const displayName  = user?.firstName ? `${user.firstName} ${user.lastName}` : (user?.email ?? "Administrador")
  const roleLabel    = user ? (ROLE_LABELS[user.role] ?? user.role) : ""

  const handleLogout = async () => { await logout(); router.push("/login") }

  const brandInitial = user?.tenantName ? user.tenantName[0].toUpperCase() : "C"
  const brandName = user?.tenantName || "Classia"

  return (
    <PortalSidebar
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      brandInitial={brandInitial}
      brandName={brandName}
      mobileTopBarRightSlot={<UnreadBell href="/admin/notificaciones" />}
      initials={initials}
      displayName={displayName}
      roleLabel={roleLabel}
      onLogout={handleLogout}
      showUserInfo={!!user}
    >
      {(closeMobileMenu) => (
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {navigation.map((item) => {
            if (item.children) {
              const isExpanded = expanded[item.name]
              const hasActiveChild = item.children.some(child => pathname === child.href || pathname.startsWith(`${child.href}/`))

              return (
                <div key={item.name} className="space-y-0.5">
                  <button
                    onClick={() => toggleCategory(item.name)}
                    title={isCollapsed ? item.name : undefined}
                    className={[
                      "flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                      isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                      hasActiveChild && !isExpanded
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ].join(" ")}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.name}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </button>

                  {!isCollapsed && isExpanded && (
                    <div className="mt-1 space-y-0.5 pl-9 pr-1">
                      {item.children.map(child => {
                        const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            onClick={closeMobileMenu}
                            className={[
                              "flex items-center gap-2 truncate rounded-md px-3 py-2 text-xs font-medium transition-colors",
                              childActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            ].join(" ")}
                          >
                            <child.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{child.name}</span>
                            {child.soon && (
                              <span className="ml-auto shrink-0 rounded bg-sidebar-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                                Pronto
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.name}
                href={item.href!}
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
                {item.href?.endsWith("/notificaciones") && (
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
