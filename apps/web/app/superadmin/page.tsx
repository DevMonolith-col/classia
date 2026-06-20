"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  Globe2,
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TenantStatus = "ACTIVE" | "PILOT" | "DEMO" | "SUSPENDED" | "INACTIVE"

type Tenant = {
  id: string
  name: string
  slug: string
  status?: TenantStatus
  primaryDomain?: string | null
  brandColor?: string | null
  createdAt?: string
  updatedAt?: string
  _count?: {
    users?: number
    memberships?: number
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

// Datos temporales para sostener la base visual del dashboard mientras se completa el contrato real de metricas.
const fallbackTenants: Tenant[] = [
  {
    id: "demo",
    name: "Colegio Demo Classia",
    slug: "demo",
    status: "DEMO",
    primaryDomain: "app.demo.classia.com.co",
    brandColor: "#212121",
    updatedAt: "2026-05-31T09:10:00.000Z",
    _count: { users: 4 },
  },
  {
    id: "san-jose",
    name: "Colegio San Jose",
    slug: "san-jose",
    status: "PILOT",
    primaryDomain: "app.san-jose.classia.com.co",
    brandColor: "#424242",
    updatedAt: "2026-05-30T18:25:00.000Z",
    _count: { users: 38 },
  },
  {
    id: "montessori-norte",
    name: "Instituto Montessori Norte",
    slug: "montessori-norte",
    status: "ACTIVE",
    primaryDomain: "app.montessori-norte.classia.com.co",
    brandColor: "#111111",
    updatedAt: "2026-05-30T14:48:00.000Z",
    _count: { users: 216 },
  },
  {
    id: "andino",
    name: "Gimnasio Andino",
    slug: "andino",
    status: "SUSPENDED",
    primaryDomain: "app.andino.classia.com.co",
    brandColor: "#666666",
    updatedAt: "2026-05-28T11:20:00.000Z",
    _count: { users: 91 },
  },
]

const fallbackAudit: AuditLog[] = [
  {
    id: "audit-1",
    tenantId: "demo",
    actorRole: "SUPER_ADMIN",
    action: "tenant.updated",
    entityType: "Tenant",
    ipAddress: "127.0.0.1",
    createdAt: "2026-05-31T09:18:00.000Z",
  },
  {
    id: "audit-2",
    tenantId: "san-jose",
    actorRole: "SUPPORT_AGENT",
    action: "support.access.requested",
    entityType: "Tenant",
    ipAddress: "127.0.0.1",
    createdAt: "2026-05-31T08:52:00.000Z",
  },
  {
    id: "audit-3",
    tenantId: "montessori-norte",
    actorRole: "TENANT_ADMIN",
    action: "auth.login",
    entityType: "User",
    ipAddress: "127.0.0.1",
    createdAt: "2026-05-31T08:41:00.000Z",
  },
]

const statusLabels: Record<string, string> = {
  ACTIVE: "Activo",
  PILOT: "Piloto",
  DEMO: "Demo",
  SUSPENDED: "Suspendido",
  INACTIVE: "Inactivo",
}

const statusClassName: Record<string, string> = {
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  PILOT: "border-blue-200 bg-blue-50 text-blue-700",
  DEMO: "border-neutral-200 bg-neutral-50 text-neutral-700",
  SUSPENDED: "border-red-200 bg-red-50 text-red-700",
  INACTIVE: "border-neutral-200 bg-neutral-50 text-neutral-500",
}

function formatRelativeDate(value?: string) {
  if (!value) return "Sin actividad"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin actividad"
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getTenantUsage(index: number) {
  // Uso simulado temporal: reemplazar por metricas reales del backend en SuperAdmin v1 funcional.
  const values = [18, 44, 73, 91]
  return values[index % values.length]
}

export default function SuperAdminDashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      setLoading(true)
      setError("")

      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 2500)
        const [tenantResponse, auditResponse] = await Promise.all([
          apiFetch("/tenants", { silent: true, signal: controller.signal }),
          apiFetch("/audit/logs?limit=6", { silent: true, signal: controller.signal }),
        ])
        window.clearTimeout(timeoutId)

        const tenantData = tenantResponse.ok ? ((await tenantResponse.json()) as Tenant[]) : []
        const auditData = auditResponse.ok ? ((await auditResponse.json()) as { items?: AuditLog[] }) : {}

        if (!mounted) return
        setTenants(Array.isArray(tenantData) && tenantData.length > 0 ? tenantData : fallbackTenants)
        setAuditLogs(Array.isArray(auditData.items) && auditData.items.length > 0 ? auditData.items : fallbackAudit)
        if (!tenantResponse.ok || !auditResponse.ok) {
          setError("Mostrando datos de referencia porque la API no devolvio informacion completa.")
        }
      } catch {
        if (!mounted) return
        setTenants(fallbackTenants)
        setAuditLogs(fallbackAudit)
        setError("Mostrando datos de referencia mientras la API no esta disponible.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      mounted = false
    }
  }, [])

  const filteredTenants = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return tenants
    return tenants.filter((tenant) =>
      [tenant.name, tenant.slug, tenant.primaryDomain, tenant.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [query, tenants])

  const activeTenants = tenants.filter((tenant) => tenant.status === "ACTIVE").length
  const pilotTenants = tenants.filter((tenant) => tenant.status === "PILOT" || tenant.status === "DEMO").length
  const suspendedTenants = tenants.filter((tenant) => tenant.status === "SUSPENDED" || tenant.status === "INACTIVE").length
  const users = tenants.reduce((total, tenant) => total + (tenant._count?.users ?? tenant._count?.memberships ?? 0), 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operacion global</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Panel SaaS</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <Server className="h-4 w-4 text-green-600" />
              Produccion estable
            </div>
            <Button variant="outline" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Revisar auditoria
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo colegio
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Colegios totales" value={tenants.length} icon={Building2} helper={`${activeTenants} activos`} loading={loading} />
          <MetricCard title="Usuarios activos" value={users} icon={Users} helper="Incluye membresias globales" loading={loading} />
          <MetricCard title="Pilotos y demos" value={pilotTenants} icon={Globe2} helper="En seguimiento comercial" loading={loading} />
          <MetricCard title="Alertas operativas" value={suspendedTenants} icon={ShieldCheck} helper="Requieren revision" loading={loading} />
        </section>

        <section className="mt-6 grid min-w-0 gap-6 min-[1800px]:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-w-0">
            <CardHeader className="gap-4 border-b border-border">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Operaciones de colegios</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Gestion global de tenants, dominios, estados y uso de la plataforma.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar colegio o dominio"
                      className="h-9 w-full pl-9 sm:w-64"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Actualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
                  ))}
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                  <h2 className="mt-3 text-base font-semibold text-foreground">No hay colegios para este filtro</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ajusta la busqueda o crea un nuevo tenant.</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Colegio</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Dominio</TableHead>
                          <TableHead>Usuarios</TableHead>
                          <TableHead>Uso</TableHead>
                          <TableHead className="pr-6 text-right">Ultima actividad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenants.map((tenant, index) => {
                          const usage = getTenantUsage(index)
                          return (
                            <TableRow key={tenant.id}>
                              <TableCell className="pl-6">
                                <TenantIdentity tenant={tenant} />
                              </TableCell>
                              <TableCell>Base</TableCell>
                              <TableCell>
                                <TenantStatusBadge status={tenant.status} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Globe2 className="h-4 w-4" />
                                  {tenant.primaryDomain ?? `app.${tenant.slug}.classia.com.co`}
                                </div>
                              </TableCell>
                              <TableCell>{tenant._count?.users ?? tenant._count?.memberships ?? 0}</TableCell>
                              <TableCell>
                                <TenantUsage value={usage} />
                              </TableCell>
                              <TableCell className="pr-6 text-right text-sm text-muted-foreground">{formatRelativeDate(tenant.updatedAt ?? tenant.createdAt)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 p-4 md:hidden">
                    {filteredTenants.map((tenant, index) => {
                      const usage = getTenantUsage(index)
                      return (
                        <div key={tenant.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <TenantIdentity tenant={tenant} />
                            <TenantStatusBadge status={tenant.status} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                            <div>
                              <p className="font-medium text-foreground">{tenant._count?.users ?? tenant._count?.memberships ?? 0}</p>
                              <p>Usuarios</p>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{formatRelativeDate(tenant.updatedAt ?? tenant.createdAt)}</p>
                              <p>Ultima actividad</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <TenantUsage value={usage} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <aside className="min-w-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Solicitudes de soporte</CardTitle>
                <p className="text-sm text-muted-foreground">Accesos temporales deben quedar auditados antes de entrar a un tenant.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ["Colegio San Jose", "Restablecer usuario de rectoria", "Pendiente"],
                  ["Gimnasio Andino", "Revision de dominio suspendido", "Critico"],
                  ["Demo Classia", "Validar ambiente de piloto", "Nuevo"],
                ].map(([school, reason, status]) => (
                  <div key={school} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{school}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
                      </div>
                      <Badge variant={status === "Critico" ? "destructive" : "secondary"}>{status}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2 h-8 gap-1 px-0">
                      Revisar acceso
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Auditoria reciente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(loading ? fallbackAudit : auditLogs).map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <ClipboardList className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.actorRole ?? "Sistema"} · {log.entityType ?? "Entidad"} · {formatRelativeDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <ActionCard icon={Plus} title="Crear demo" description="Provisiona un tenant demo sin exponer datos reales entre colegios." />
          <ActionCard icon={Database} title="Revisar respaldos" description="Confirma integridad de backups y separacion logica por tenant." />
          <ActionCard icon={LifeBuoy} title="Abrir soporte auditado" description="Atiende solicitudes con trazabilidad y alcance temporal." />
        </section>
      </div>
    </div>
  )
}

function TenantIdentity({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{ backgroundColor: tenant.brandColor ?? "#212121" }}
      >
        {tenant.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{tenant.name}</p>
        <p className="truncate text-xs text-muted-foreground">{tenant.slug}</p>
      </div>
    </div>
  )
}

function TenantStatusBadge({ status }: { status?: TenantStatus }) {
  return (
    <Badge variant="outline" className={statusClassName[status ?? "DEMO"] ?? statusClassName.DEMO}>
      {statusLabels[status ?? "DEMO"] ?? status ?? "Demo"}
    </Badge>
  )
}

function TenantUsage({ value }: { value: number }) {
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-secondary">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}%</span>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  helper,
  loading,
}: {
  title: string
  value: number
  icon: typeof Building2
  helper: string
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </div>
        <div className="mt-5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{loading ? "..." : value.toLocaleString("es-CO")}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {helper}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Activity
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
