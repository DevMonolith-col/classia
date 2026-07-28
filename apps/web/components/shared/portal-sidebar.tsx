"use client"

import Link from "next/link"
import { useState, type ComponentType, type ReactNode } from "react"
import { LogOut, Menu, X } from "lucide-react"

type IconComponent = ComponentType<{ className?: string }>

interface PortalSidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  /** Icono del botón de colapsar en escritorio. Cada portal ya lo elegía por su cuenta
   * (Menu en la mayoría, PanelLeftClose en SuperAdmin) — se preserva tal cual. */
  collapseIcon?: IconComponent
  brandInitial: string
  brandName: string
  /** Texto de marca en la barra móvil, si difiere del de escritorio (SuperAdmin muestra
   * "Classia SaaS" en una sola línea en móvil vs. "Classia" + subtítulo en escritorio).
   * Default: brandName. */
  mobileBrandName?: string
  /** Solo SuperAdmin lo usa ("Operación SaaS"). */
  brandSubtitle?: string
  /** Si se pasa, la marca se renderiza como link (solo SuperAdmin hoy). */
  brandHref?: string
  /** Ancho del sidebar expandido en escritorio. Default "lg:w-64"; SuperAdmin usa "lg:w-72". */
  expandedWidthClass?: string
  /** Elemento a la derecha de la barra superior móvil (campana de no-leídos, etc). */
  mobileTopBarRightSlot?: ReactNode
  initials: string
  displayName: string
  roleLabel: string
  onLogout: () => void | Promise<void>
  /** Contenido extra sobre el bloque de usuario (la tarjeta "Sistema operativo" de SuperAdmin). */
  extraFooterContent?: ReactNode
  /** Los 4 portales flat solo muestran el bloque de usuario una vez que `user` cargó desde
   * localStorage; SuperAdmin nunca lo gateaba. Default true para preservar ese último caso. */
  showUserInfo?: boolean
  /** El <nav> de cada portal, con su propia lógica de items/rutas activas — el shell no la toca.
   * Recibe closeMobileMenu para que los Links puedan cerrar el drawer móvil al navegar. */
  children: (closeMobileMenu: () => void) => ReactNode
}

export function PortalSidebar({
  isCollapsed,
  onToggle,
  collapseIcon: CollapseIcon = Menu,
  brandInitial,
  brandName,
  mobileBrandName,
  brandSubtitle,
  brandHref,
  expandedWidthClass = "lg:w-64",
  mobileTopBarRightSlot,
  initials,
  displayName,
  roleLabel,
  onLogout,
  extraFooterContent,
  showUserInfo = true,
  children,
}: PortalSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobileMenu = () => setMobileOpen(false)

  const brandBlock = (
    <div className="flex flex-1 items-center gap-2 overflow-hidden">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
        <span className="text-sm font-bold text-sidebar-primary-foreground">{brandInitial}</span>
      </div>
      {brandSubtitle ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-sidebar-foreground">{brandName}</p>
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
            {brandSubtitle}
          </p>
        </div>
      ) : (
        <span className="truncate font-bold text-sidebar-foreground">{brandName}</span>
      )}
    </div>
  )

  return (
    <>
      {/* ── Top bar solo móvil ─────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-foreground" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
        {brandHref ? (
          <Link href={brandHref} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">{brandInitial}</span>
            </div>
            <span className="font-bold">{mobileBrandName ?? brandName}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">{brandInitial}</span>
            </div>
            <span className="font-bold truncate max-w-[150px]">{brandName}</span>
          </div>
        )}
        {mobileTopBarRightSlot ?? <div className="h-9 w-9" />}
      </header>

      {/* ── Overlay móvil ──────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={closeMobileMenu} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar transition-all duration-300",
          "w-64",
          isCollapsed ? "lg:w-16" : expandedWidthClass,
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        {/* Header del sidebar */}
        <div className={`flex h-16 shrink-0 items-center border-b border-sidebar-border ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
          {!isCollapsed && (brandHref ? <Link href={brandHref} className="flex flex-1 items-center gap-2 overflow-hidden">{brandBlock}</Link> : brandBlock)}
          {/* Botón colapsar/expandir desktop */}
          <button
            onClick={onToggle}
            className="hidden shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            aria-label="Contraer menú"
          >
            <CollapseIcon className="h-5 w-5" />
          </button>
          {/* Botón cerrar móvil */}
          <button
            onClick={closeMobileMenu}
            className="shrink-0 rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegación: cada portal trae la suya, con su propia lógica de ruta activa */}
        {children(closeMobileMenu)}

        {/* Usuario + logout */}
        <div className="shrink-0 space-y-3 border-t border-sidebar-border p-3">
          {!isCollapsed && extraFooterContent}
          {!isCollapsed && showUserInfo && (
            <div className="flex items-center gap-2 px-2">
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
            onClick={() => void onLogout()}
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
