"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  FileText,
  ClipboardList,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  ClipboardCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Mi Panel", href: "/profesor", icon: LayoutDashboard },
  { name: "Mis Clases", href: "/profesor/clases", icon: BookOpen },
  { name: "Estudiantes", href: "/profesor/estudiantes", icon: Users },
  { name: "Calificaciones", href: "/profesor/calificaciones", icon: ClipboardList },
  { name: "Tareas", href: "/profesor/tareas", icon: FileText },
  { name: "Asistencia", href: "/profesor/asistencia", icon: ClipboardCheck },
  { name: "Horario", href: "/profesor/horario", icon: Calendar },
  { name: "Mensajes", href: "/profesor/mensajes", icon: MessageSquare },
  { name: "Configuración", href: "/profesor/configuracion", icon: Settings },
]

export function ProfesorSidebar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <Link href="/profesor" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">C</span>
          </div>
          <span className="font-bold text-foreground">Classia</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
          </Button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center rounded-md p-2 text-foreground"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar transition-transform lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sm font-bold text-sidebar-primary-foreground">C</span>
          </div>
          <div>
            <span className="font-bold text-sidebar-foreground">Classia</span>
            <p className="text-xs text-sidebar-foreground/60">Portal Docente</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User Menu */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent">
              <span className="text-sm font-semibold text-sidebar-accent-foreground">JL</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                Prof. Juan López
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                Matemáticas
              </p>
            </div>
            <button className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="ghost"
            className="mt-4 w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>
    </>
  )
}
