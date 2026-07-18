"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  MessageSquare, BarChart3, Settings, LogOut, Menu, X,
  Bell, FileText, ClipboardCheck, ClipboardList, Puzzle, CalendarClock, Megaphone, SlidersHorizontal, LifeBuoy, ChevronDown,
  UserCog, School, BookMarked, Mail, Briefcase
} from "lucide-react"
import { logout, getStoredUser } from "@/lib/auth"

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
  children?: { name: string; href: string; icon: any }[];
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    name: "Comunidad",
    icon: Users,
    children: [
      { name: "Estudiantes", href: "/admin/estudiantes", icon: GraduationCap },
      { name: "Profesores", href: "/admin/profesores", icon: UserCog },
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
      { name: "Soporte", href: "/admin/soporte", icon: LifeBuoy },
      { name: "Plugins", href: "/admin/plugins", icon: Puzzle },
      { name: "Configuración", href: "/admin/configuracion", icon: Settings },
    ]
  }
]

interface Props { isCollapsed: boolean; onToggle: () => void }

export function AdminSidebar({ isCollapsed, onToggle }: Props) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "Académico": true,
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

  return (
    <>
      {/* ── Top bar solo móvil ─────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-foreground" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">{user?.tenantName ? user.tenantName[0].toUpperCase() : "C"}</span>
          </div>
          <span className="font-bold truncate max-w-[150px]">{user?.tenantName || "Classia"}</span>
        </div>
        <button className="relative rounded-md p-2 text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
      </header>

      {/* ── Overlay móvil ──────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className={[
        "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar transition-all duration-300",
        "w-64",                                          // ancho en móvil siempre 64
        isCollapsed ? "lg:w-16" : "lg:w-64",            // desktop: colapsa a 16
        mobileOpen  ? "translate-x-0" : "-translate-x-full", // móvil: open/close
        "lg:translate-x-0",                             // desktop: siempre visible
      ].join(" ")}>

        {/* Header del sidebar */}
        <div className={`flex h-16 shrink-0 items-center border-b border-sidebar-border ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
          {!isCollapsed && (
            <div className="flex flex-1 items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                <span className="text-sm font-bold text-sidebar-primary-foreground">{user?.tenantName ? user.tenantName[0].toUpperCase() : "C"}</span>
              </div>
              <span className="truncate font-bold text-sidebar-foreground">{user?.tenantName || "Classia"}</span>
            </div>
          )}
          {/* Botón hamburguesa desktop */}
          <button
            onClick={onToggle}
            className="hidden shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Botón cerrar móvil */}
          <button
            onClick={() => setMobileOpen(false)}
            className="shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegación */}
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
                            onClick={() => setMobileOpen(false)}
                            className={[
                              "flex items-center gap-2 truncate rounded-md px-3 py-2 text-xs font-medium transition-colors",
                              childActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            ].join(" ")}
                          >
                            <child.icon className="h-4 w-4 shrink-0" />
                            {child.name}
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
                onClick={() => setMobileOpen(false)}
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

        {/* Usuario + logout */}
        <div className="shrink-0 space-y-1 border-t border-sidebar-border p-3">
          {!isCollapsed && user && (
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                <span className="text-xs font-semibold text-sidebar-accent-foreground">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
                <p className="truncate text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">{roleLabel}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Cerrar sesión" : undefined}
            className={[
              "flex w-full items-center rounded-lg py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              isCollapsed ? "justify-center px-2" : "gap-2 px-3",
            ].join(" ")}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && "Cerrar sesión"}
          </button>
        </div>
      </aside>
    </>
  )
}
