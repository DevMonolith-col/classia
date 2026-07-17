"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  LogIn,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api-client"
import { impersonateTenant } from "@/lib/auth"
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
import { TenantFormDialog } from "@/components/superadmin/tenant-form-dialog"
import type { Tenant, TenantStatus } from "@/components/superadmin/tenant-types"

const PAGE_SIZE = 10

const statusLabels: Record<TenantStatus, string> = {
  DEMO: "Demo",
  PILOT: "Piloto",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
}

const statusClassName: Record<TenantStatus, string> = {
  DEMO: "border-neutral-200 bg-neutral-50 text-neutral-700",
  PILOT: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  SUSPENDED: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-neutral-200 bg-neutral-50 text-neutral-500",
}

const planLabels: Record<string, string> = {
  BASE: "Base",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
}

const planLimits: Record<string, { maxStudents: number; maxUsers: number; maxStorageGb: number }> = {
  BASE: { maxStudents: 200, maxUsers: 30, maxStorageGb: 5 },
  PRO: { maxStudents: 800, maxUsers: 100, maxStorageGb: 25 },
  ENTERPRISE: { maxStudents: 5000, maxUsers: 500, maxStorageGb: 100 },
}

function tenantUsage(tenant: Tenant) {
  const plan = planLimits[tenant.plan ?? "BASE"] ?? planLimits.BASE
  const studentsPct = Math.min(100, Math.round(((tenant._count?.students ?? 0) / plan.maxStudents) * 100))
  const usersPct = Math.min(100, Math.round(((tenant._count?.memberships ?? 0) / plan.maxUsers) * 100))
  const maxPct = Math.max(studentsPct, usersPct)
  return { studentsPct, usersPct, maxPct, totalUsers: (tenant._count?.memberships ?? 0) + (tenant._count?.students ?? 0) }
}

function UsageBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{percent}%</span>
    </div>
  )
}

function formatDate(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}


export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | undefined>()
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const router = useRouter()

  const loadTenants = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/tenants", { silent: true })
      if (!res.ok) {
        throw new Error(res.status === 403 ? "No tienes permiso para ver los colegios." : "No se pudo cargar el listado de colegios.")
      }
      const data = (await res.json()) as Tenant[]
      setTenants(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setTenants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  const filteredTenants = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return tenants
    return tenants.filter((tenant) =>
      [tenant.name, tenant.slug, tenant.primaryDomain, tenant.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [query, tenants])

  const pageCount = Math.max(1, Math.ceil(filteredTenants.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginatedTenants = filteredTenants.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query])

  const openCreateDialog = () => {
    setEditingTenant(undefined)
    setDialogOpen(true)
  }

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant)
    setDialogOpen(true)
  }

  const handleImpersonate = async (tenantId: string) => {
    try {
      setImpersonatingId(tenantId)
      await impersonateTenant(tenantId)
      router.push("/admin")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión en el colegio")
      setImpersonatingId(null)
    }
  }

  function handleSaved(saved: Tenant) {
    setTenants((current) => {
      const exists = current.some((tenant) => tenant.id === saved.id)
      if (exists) {
        return current.map((tenant) => (tenant.id === saved.id ? saved : tenant))
      }
      return [saved, ...current]
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operacion global</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Colegios</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" size="sm" className="gap-2" onClick={loadTenants} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button className="gap-2" onClick={openCreateDialog}>
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

        <Card className="min-w-0">
          <CardHeader className="gap-4 border-b border-border">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Operaciones de colegios</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? "Cargando..." : `Gestion global de tenants, dominios, estados y uso de la plataforma.`}
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar colegio o dominio"
                  className="h-9 w-full pl-9 sm:w-64"
                />
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
                <h2 className="mt-3 text-base font-semibold text-foreground">
                  {tenants.length === 0 ? "Aun no hay colegios registrados" : "No hay colegios para este filtro"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tenants.length === 0 ? "Crea el primer tenant para empezar." : "Ajusta la busqueda o crea un nuevo tenant."}
                </p>
                {tenants.length === 0 && (
                  <Button className="mt-4 gap-2" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                    Nuevo colegio
                  </Button>
                )}
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
                        <TableHead className="text-center">Usuarios</TableHead>
                        <TableHead>Uso</TableHead>
                        <TableHead>Última actividad</TableHead>
                        <TableHead className="pr-6 text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTenants.map((tenant) => {
                        const usage = tenantUsage(tenant)
                        return (
                        <TableRow key={tenant.id}>
                          <TableCell className="pl-6">
                            <TenantIdentity tenant={tenant} />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-foreground">{planLabels[tenant.plan ?? "BASE"] ?? "Base"}</span>
                          </TableCell>
                          <TableCell>
                            <TenantStatusBadge status={tenant.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Globe2 className="h-4 w-4" />
                              {tenant.primaryDomain ?? `app.${tenant.slug}.classia.com.co`}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {(tenant._count?.memberships ?? 0) + (tenant._count?.students ?? 0)}
                          </TableCell>
                          <TableCell>
                            <UsageBar percent={usage.maxPct} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(tenant.updatedAt ?? tenant.createdAt)}</TableCell>
                          <TableCell className="pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={impersonatingId === tenant.id}
                                onClick={() => handleImpersonate(tenant.id)}
                              >
                                <LogIn className={`h-3.5 w-3.5 ${impersonatingId === tenant.id ? "animate-pulse" : ""}`} />
                                Acceder
                              </Button>
                              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(tenant)}>
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {paginatedTenants.map((tenant) => (
                    <div key={tenant.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <TenantIdentity tenant={tenant} />
                        <TenantStatusBadge status={tenant.status} />
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe2 className="h-3.5 w-3.5" />
                        {tenant.primaryDomain ?? `app.${tenant.slug}.classia.com.co`}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Creado {formatDate(tenant.createdAt)}</p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1.5" 
                            disabled={impersonatingId === tenant.id}
                            onClick={() => handleImpersonate(tenant.id)}
                          >
                            <LogIn className={`h-3.5 w-3.5 ${impersonatingId === tenant.id ? "animate-pulse" : ""}`} />
                            Acceder
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(tenant)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {pageCount > 1 && (
                  <div className="flex items-center justify-between border-t border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      Página {currentPage} de {pageCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        disabled={currentPage >= pageCount}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <TenantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={editingTenant}
        onSaved={handleSaved}
      />
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

function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <Badge variant="outline" className={statusClassName[status] ?? statusClassName.DEMO}>
      {statusLabels[status] ?? status}
    </Badge>
  )
}
