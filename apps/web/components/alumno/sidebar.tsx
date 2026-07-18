"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Home, ClipboardList, FileText, Vote,
  LogOut, Menu, X,
} from "lucide-react"
import { logout, getStoredUser } from "@/lib/auth"

const navigation = [
  { name: "Mi Panel",       href: "/alumno",               icon: Home },
  { name: "Asignaciones",   href: "/alumno/asignaciones",  icon: FileText },
  { name: "Calificaciones", href: "/alumno/calificaciones",icon: ClipboardList },
  { name: "Votación",       href: "/alumno/votacion",      icon: Vote },
]

interface Props { isCollapsed: boolean; onToggle: () => void }

export function AlumnoSidebar({ isCollapsed, onToggle }: Props) {
  const pathname     = usePathname()
  const router       = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string } | null>(null)

  useEffect(() => { setUser(getStoredUser()) }, [])

  const initials    = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "ES"
  const displayName = user ? `${user.firstName} ${user.lastName}` : "Estudiante"

  const handleLogout = async () => { await logout(); router.push("/login") }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-foreground" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">C</span>
          </div>
          <span className="font-bold">Classia</span>
        </div>
        <div className="h-9 w-9" />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={[
        "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar transition-all duration-300",
        "w-64",
        isCollapsed ? "lg:w-16" : "lg:w-64",
        mobileOpen  ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
      ].join(" ")}>

        <div className={`flex h-16 shrink-0 items-center border-b border-sidebar-border ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
          {!isCollapsed && (
            <div className="flex flex-1 items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                <span className="text-sm font-bold text-sidebar-primary-foreground">C</span>
              </div>
              <span className="truncate font-bold text-sidebar-foreground">Classia</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className="hidden shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navigation.map((item) => {
            const active = pathname === item.href
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
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-sidebar-border p-3">
          {!isCollapsed && user && (
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                <span className="text-xs font-semibold text-sidebar-accent-foreground">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
                <p className="truncate text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">Estudiante</p>
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
