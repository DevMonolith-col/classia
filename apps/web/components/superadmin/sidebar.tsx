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
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react"
import { getStoredUser, logout } from "@/lib/auth"

const navigation = [
  { name: "Panel SaaS", href: "/superadmin", icon: Gauge, available: true },
  { name: "Colegios", href: "/superadmin/tenants", icon: Building2, available: true },
  { name: "Usuarios globales", href: "/superadmin/users", icon: Users, available: true },
  { name: "Auditoria", href: "/superadmin/audit", icon: ClipboardList, available: false },
  { name: "Soporte", href: "/superadmin/support", icon: LifeBuoy, available: false },
  { name: "Seguridad", href: "/superadmin/security", icon: ShieldCheck, available: false },
  { name: "Configuracion", href: "/superadmin/settings", icon: Settings, available: false },
]

interface Props {
  isCollapsed: boolean
  onToggle: () => void
}

export function SuperAdminSidebar({ isCollapsed, onToggle }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string } | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  const displayName = user ? `${user.firstName} ${user.lastName}` : "Super Admin"
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "SA"

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-foreground" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/superadmin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">C</span>
          </div>
          <span className="font-bold">Classia SaaS</span>
        </Link>
        <button className="relative rounded-md p-2 text-foreground" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
      </header>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar transition-all duration-300",
          "w-64",
          isCollapsed ? "lg:w-16" : "lg:w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        <div className={`flex h-16 shrink-0 items-center border-b border-sidebar-border ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
          {!isCollapsed && (
            <Link href="/superadmin" className="flex flex-1 items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                <span className="text-sm font-bold text-sidebar-primary-foreground">C</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-sidebar-foreground">Classia</p>
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">Operacion SaaS</p>
              </div>
            </Link>
          )}
          <button
            onClick={onToggle}
            className="hidden shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            aria-label="Contraer menu"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
            aria-label="Cerrar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isCollapsed && (
          <div className="border-b border-sidebar-border p-3">
            <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-sm text-sidebar-foreground/70">
              <Search className="h-4 w-4" />
              <span>Buscar colegio, usuario o dominio</span>
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
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
                href={item.href}
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
                {content}
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 space-y-3 border-t border-sidebar-border p-3">
          {!isCollapsed && (
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3">
              <div className="flex items-center gap-2 text-sidebar-foreground">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-semibold">Sistema operativo</span>
              </div>
              <p className="mt-1 text-xs text-sidebar-foreground/60">API, base de datos y Redis sin incidentes criticos.</p>
            </div>
          )}
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                <span className="text-xs font-semibold text-sidebar-accent-foreground">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
                <p className="truncate text-xs text-sidebar-foreground/50">Super Administrador</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Cerrar sesion" : undefined}
            className={[
              "flex w-full items-center rounded-lg py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              isCollapsed ? "justify-center px-2" : "gap-2 px-3",
            ].join(" ")}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && "Cerrar sesion"}
          </button>
        </div>
      </aside>
    </>
  )
}
