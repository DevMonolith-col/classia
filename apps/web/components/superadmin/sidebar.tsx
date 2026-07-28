"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Activity,
  Bell,
  Building2,
  ClipboardList,
  Gauge,
  Inbox,
  LifeBuoy,
  Menu,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Users,
  ChevronDown,
  MessageSquare,
} from "lucide-react"
import { getStoredUser, logout } from "@/lib/auth"
import { PortalSidebar } from "@/components/shared/portal-sidebar"

const SUPERADMIN_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  SUPPORT_SUPERVISOR: "Supervisor de Soporte",
  SUPPORT_AGENT: "Agente de Soporte",
}

type NavItem = {
  name: string
  href?: string
  icon: any
  available?: boolean
  children?: { name: string; href: string; icon: any; roles?: string[] }[]
  roles?: string[]
}

const navigation: NavItem[] = [
  { name: "Panel SaaS", href: "/superadmin", icon: Gauge, available: true, roles: ["SUPER_ADMIN"] },
  { name: "Colegios", href: "/superadmin/tenants", icon: Building2, available: true, roles: ["SUPER_ADMIN"] },
  { name: "Solicitudes", href: "/superadmin/solicitudes", icon: Inbox, available: true, roles: ["SUPER_ADMIN"] },
  { name: "Usuarios globales", href: "/superadmin/users", icon: Users, available: true, roles: ["SUPER_ADMIN"] },
  { name: "Auditoria", href: "/superadmin/audit", icon: ClipboardList, available: true, roles: ["SUPER_ADMIN"] },
  { 
    name: "Soporte", 
    icon: LifeBuoy, 
    available: true,
    children: [
      { name: "Centro de Mando", href: "/superadmin/support/dashboard", icon: Building2, roles: ["SUPER_ADMIN", "SUPPORT_SUPERVISOR"] },
      { name: "Cola de Triage", href: "/superadmin/support/triage", icon: LifeBuoy, roles: ["SUPER_ADMIN", "SUPPORT_SUPERVISOR"] },
      { name: "Inbox de Agente", href: "/superadmin/support/inbox", icon: MessageSquare, roles: ["SUPER_ADMIN", "SUPPORT_SUPERVISOR", "SUPPORT_AGENT"] }
    ]
  },
  { name: "Seguridad", href: "/superadmin/security", icon: ShieldCheck, available: false, roles: ["SUPER_ADMIN"] },
  { name: "Configuracion", href: "/superadmin/settings", icon: Settings, available: true, roles: ["SUPER_ADMIN"] },
]

interface Props {
  isCollapsed: boolean
  onToggle: () => void
}

export function SuperAdminSidebar({ isCollapsed, onToggle }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "Soporte": true })
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string } | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  useEffect(() => {
    navigation.forEach(item => {
      if (item.children && item.children.some(child => pathname === child.href || pathname.startsWith(`${child.href}/`))) {
        setExpanded(prev => ({ ...prev, [item.name]: true }))
      }
    })
  }, [pathname])

  const toggleCategory = (name: string) => {
    if (isCollapsed) onToggle()
    else setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const displayName = user?.firstName ? `${user.firstName} ${user.lastName}` : (user?.email ?? "Super Admin")
  const initials = user?.firstName ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase() : "SA"

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const statusCard = (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3">
      <div className="flex items-center gap-2 text-sidebar-foreground">
        <Activity className="h-4 w-4" />
        <span className="text-sm font-semibold">Sistema operativo</span>
      </div>
      <p className="mt-1 text-xs text-sidebar-foreground/60">API, base de datos y Redis sin incidentes criticos.</p>
    </div>
  )

  return (
    <PortalSidebar
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      collapseIcon={PanelLeftClose}
      brandInitial="C"
      brandName="Classia"
      mobileBrandName="Classia SaaS"
      brandSubtitle="Operacion SaaS"
      brandHref="/superadmin"
      expandedWidthClass="lg:w-72"
      mobileTopBarRightSlot={
        <button className="relative rounded-md p-2 text-foreground" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
      }
      initials={initials}
      displayName={displayName}
      roleLabel={SUPERADMIN_ROLE_LABELS[user?.role ?? ""] ?? "Super Administrador"}
      onLogout={handleLogout}
      extraFooterContent={statusCard}
    >
      {(closeMobileMenu) => (
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navigation.map((item) => {
            if (item.roles && user && !item.roles.includes(user.role)) return null

            if (item.children) {
              const isExpanded = expanded[item.name]
              const hasActiveChild = item.children.some(child => pathname === child.href || pathname.startsWith(`${child.href}/`))

              const visibleChildren = item.children.filter(child => !child.roles || (user && child.roles.includes(user.role)))

              if (visibleChildren.length === 0 && user) return null

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
                      {visibleChildren.map(child => {
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
                            {child.name}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const active = pathname === item.href || pathname.startsWith(`${item.href!}/`)
            const content = (
              <>
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
                {!isCollapsed && !item.available && <span className="ml-auto rounded bg-sidebar-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Pronto</span>}
              </>
            )

            if (!item.available) {
              return (
                <button
                  key={item.name}
                  type="button"
                  disabled
                  title={isCollapsed ? `${item.name} - pronto` : undefined}
                  className={[
                    "flex w-full cursor-not-allowed items-center rounded-lg py-2.5 text-sm font-medium opacity-50",
                    isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                  ].join(" ")}
                >
                  {content}
                </button>
              )
            }

            return (
              <Link
                key={item.name}
                href={item.href!}
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
                {content}
              </Link>
            )
          })}
        </nav>
      )}
    </PortalSidebar>
  )
}
