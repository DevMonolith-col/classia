"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  Globe2,
  Mail,
  Plus,
  Rocket,
  Server,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { humanizeAuditAction } from "@/components/shared/audit-labels"

type TenantStatus = "ACTIVE" | "PILOT" | "DEMO" | "SUSPENDED" | "INACTIVE"

type Tenant = {
  id: string
  name: string
  slug: string
  status?: TenantStatus
  plan?: string
  primaryDomain?: string | null
  brandColor?: string | null
  createdAt?: string
  updatedAt?: string
  _count?: {
    memberships?: number
    students?: number
  }
}

type AuditLog = {
  id: string
  tenantId?: string | null
  actorRole?: string | null
  action: string
  entityType?: string | null
  ipAddress?: string | null
  createdAt: string
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "Justo ahora"
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

export default function SuperAdminDashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [healthStats, setHealthStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      setLoading(true)
      setError("")

      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 2500)
        const [tenantResponse, auditResponse, healthResponse] = await Promise.all([
          apiFetch("/tenants", { silent: true, signal: controller.signal }),
          apiFetch("/audit/logs?limit=8", { silent: true, signal: controller.signal }),
          apiFetch("/health/stats", { silent: true, signal: controller.signal }),
        ])
        window.clearTimeout(timeoutId)

        const tenantData = tenantResponse.ok ? ((await tenantResponse.json()) as Tenant[]) : []
        const auditData = auditResponse.ok ? ((await auditResponse.json()) as { items?: AuditLog[] }) : {}
        const healthData = healthResponse.ok ? await healthResponse.json() : null

        if (!mounted) return
        setTenants(Array.isArray(tenantData) ? tenantData : [])
        setAuditLogs(Array.isArray(auditData.items) ? auditData.items : [])
        setHealthStats(healthData)
        if (!tenantResponse.ok || !auditResponse.ok) {
          setError("La API no devolvió información completa.")
        }
      } catch {
        if (!mounted) return
        setTenants([])
        setAuditLogs([])
        setError("No se pudo conectar con la API.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      mounted = false
    }
  }, [])

  const activeTenants = tenants.filter((t) => t.status === "ACTIVE").length
  const pilotTenants = tenants.filter((t) => t.status === "PILOT" || t.status === "DEMO").length
  const suspendedTenants = tenants.filter((t) => t.status === "SUSPENDED" || t.status === "INACTIVE").length
  const totalUsers = tenants.reduce((sum, t) => sum + (t._count?.memberships ?? 0) + (t._count?.students ?? 0), 0)

  const stats = [
    { label: "Colegios", value: tenants.length, sub: `${activeTenants} activos`, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40", icon: Building2 },
    { label: "Usuarios", value: totalUsers, sub: "Membresías globales", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40", icon: Users },
    { label: "Pilotos / Demo", value: pilotTenants, sub: "Seguimiento comercial", color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/40", icon: Globe2 },
    { label: "Alertas", value: suspendedTenants, sub: "Requieren revisión", color: suspendedTenants > 0 ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/40" : "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40", icon: ShieldAlert },
  ]

  const topTenants = [...tenants]
    .sort((a, b) => {
      const aTotal = (a._count?.memberships ?? 0) + (a._count?.students ?? 0)
      const bTotal = (b._count?.memberships ?? 0) + (b._count?.students ?? 0)
      return bTotal - aTotal
    })
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Centro de Operaciones</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Panel SaaS</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-muted-foreground">
              <Server className="h-3.5 w-3.5 text-green-600" />
              Producción estable
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href="/superadmin/tenants">
                <Building2 className="h-3.5 w-3.5" />
                Gestión Colegios
              </Link>
            </Button>
            <Button size="sm" className="gap-1.5" asChild>
              <Link href="/superadmin/tenants">
                <Plus className="h-3.5 w-3.5" />
                Nuevo colegio
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Stats — compact inline row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="shadow-sm">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-6 w-12" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))
            : stats.map((s) => (
                <Card key={s.label} className="shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-3xl font-bold tracking-tight text-foreground">{s.value}</p>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {s.label} <span className="font-normal opacity-70">· {s.sub}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Main Grid: NOC Area + Audit Sidebar */}
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            
            {/* System Health */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Salud del Sistema</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="shadow-sm border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <CardContent className="p-4 flex gap-4 items-center">
                    <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">API Principal</p>
                      <p className={`text-xs font-semibold flex items-center gap-1 mt-0.5 ${!healthStats || healthStats?.api?.status === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {!healthStats || healthStats?.api?.status === 'up' ? <><CheckCircle2 className="h-3.5 w-3.5" /> 100% Operativo</> : <><AlertTriangle className="h-3.5 w-3.5" /> Caída</>}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <CardContent className="p-4 flex gap-4 items-center">
                    <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Base de Datos</p>
                      <p className={`text-xs font-semibold flex items-center gap-1 mt-0.5 ${!healthStats || healthStats?.db?.status === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {!healthStats || healthStats?.db?.status === 'up' ? <><CheckCircle2 className="h-3.5 w-3.5" /> {healthStats?.db?.latencyMs ?? 12}ms latencia</> : <><AlertTriangle className="h-3.5 w-3.5" /> Error</>}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <CardContent className="p-4 flex gap-4 items-center">
                    <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Caché (Redis)</p>
                      <p className={`text-xs font-semibold flex items-center gap-1 mt-0.5 ${!healthStats || healthStats?.redis?.status === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {!healthStats || healthStats?.redis?.status === 'up' ? <><CheckCircle2 className="h-3.5 w-3.5" /> {healthStats?.redis?.uptime ?? '99.9%'} Uptime</> : <><AlertTriangle className="h-3.5 w-3.5" /> Error</>}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Top Tenants & Alerts Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top Tenants */}
              <Card className="shadow-sm h-full flex flex-col">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" /> Top Consumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <div className="divide-y divide-border">
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                         <div key={i} className="p-4 flex items-center gap-3">
                           <Skeleton className="h-8 w-8 rounded-lg" />
                           <Skeleton className="h-4 w-32" />
                           <Skeleton className="h-4 w-12 ml-auto" />
                         </div>
                      ))
                    ) : topTenants.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">Sin datos suficientes</div>
                    ) : (
                      topTenants.map((tenant) => (
                        <div key={tenant.id} className="p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors">
                          <TenantIdentity tenant={tenant} />
                          <div className="text-right">
                            <p className="font-semibold text-foreground">
                              {(tenant._count?.memberships ?? 0) + (tenant._count?.students ?? 0)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Usuarios</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card className="shadow-sm h-full flex flex-col">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" /> Rendimiento de Soporte
                  </CardTitle>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                    {healthStats?.support?.openTickets || 0} Abiertos
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 flex-1">
                  <div className="grid grid-cols-2 gap-4 h-full">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex flex-col items-center justify-center border border-blue-100 dark:border-blue-900/30 text-center">
                      <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{healthStats?.support?.openTickets || 0}</p>
                      <p className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider mt-1">Tickets Abiertos</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl flex flex-col items-center justify-center border border-emerald-100 dark:border-emerald-900/30 text-center">
                      <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{healthStats?.support?.closedTickets || 0}</p>
                      <p className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider mt-1">Resueltos/Cerrados</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                    <Link href="/superadmin/support">Ir a Bandeja de Soporte <ArrowRight className="h-4 w-4 ml-2" /></Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar: Business & Operations */}
          <div className="space-y-6">
            {/* Pilotos Activos */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-violet-500" /> Pilotos Activos
                </CardTitle>
                <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400">
                  {pilotTenants} en curso
                </Badge>
              </CardHeader>
              <CardContent className="pt-4 pb-2 px-0">
                <div className="divide-y divide-border">
                  {loading ? (
                    <div className="space-y-3 px-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : tenants.filter((t) => t.status === "PILOT" || t.status === "DEMO").length === 0 ? (
                    <div className="px-4 pb-4 text-center text-sm text-muted-foreground">No hay pilotos activos</div>
                  ) : (
                    tenants
                      .filter((t) => t.status === "PILOT" || t.status === "DEMO")
                      .slice(0, 4)
                      .map((tenant) => {
                        const daysActive = Math.floor((Date.now() - new Date(tenant.createdAt ?? "").getTime()) / (1000 * 60 * 60 * 24))
                        return (
                          <div key={tenant.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{tenant.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{tenant.primaryDomain ?? tenant.slug}</p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-sm font-semibold text-foreground">{daysActive}d</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Activo</p>
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
                <div className="px-4 pt-2 pb-2">
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" asChild>
                    <Link href="/superadmin/tenants?status=PILOT">Ver todos los pilotos</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-sm bg-secondary/20">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base">Acciones Globales</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2 bg-background shadow-none" asChild>
                  <Link href="/superadmin/settings">
                    <Globe2 className="h-4 w-4 text-emerald-500" /> Configuración SaaS
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 bg-background shadow-none" asChild>
                  <Link href="/superadmin/settings">
                    <Mail className="h-4 w-4 text-blue-500" /> Broadcast Global
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 bg-background shadow-none" asChild>
                  <Link href="/superadmin/settings">
                    <Database className="h-4 w-4 text-amber-500" /> Estado de Backups
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function TenantIdentity({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
        style={{ backgroundColor: tenant.brandColor ?? "#212121" }}
      >
        {tenant.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{tenant.name}</p>
        <p className="truncate text-xs text-muted-foreground mt-0.5">{tenant.slug}</p>
      </div>
    </div>
  )
}
