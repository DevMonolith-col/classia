"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, Eye, RefreshCw, Search } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AuditLogDetailDialog } from "@/components/superadmin/audit-log-detail-dialog"
import type { AuditLog, AuditLogsResponse } from "@/components/superadmin/audit-types"
import type { Tenant } from "@/components/superadmin/tenant-types"
import { ROLE_LABELS, type User } from "@/components/superadmin/user-types"

const PAGE_SIZE = 10

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export default function SuperAdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [hasNextPage, setHasNextPage] = useState(false)

  // cursorHistory[i] is the cursor used to fetch page i (index 0 = first page = undefined).
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)

  const [tenantFilter, setTenantFilter] = useState<string>("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [query, setQuery] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeLog, setActiveLog] = useState<AuditLog | null>(null)

  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const fetchPage = useCallback(
    async (index: number, history: (string | undefined)[]) => {
      setLoading(true)
      setError("")

      try {
        const qs = buildQuery({
          tenantId: tenantFilter !== "all" ? tenantFilter : undefined,
          from: fromDate ? new Date(`${fromDate}T00:00:00.000Z`).toISOString() : undefined,
          to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
          limit: String(PAGE_SIZE),
          cursor: history[index],
        })

        const res = await apiFetch(`/audit/logs${qs}`, { silent: true })
        if (!res.ok) {
          throw new Error(res.status === 403 ? "No tienes permiso para ver la auditoría." : "No se pudo cargar la auditoría.")
        }

        const data = (await res.json()) as AuditLogsResponse
        setLogs(data.items)
        setHasNextPage(data.pageInfo.hasNextPage)
        setPageIndex(index)
        if (data.pageInfo.nextCursor && history.length === index + 1) {
          setCursorHistory([...history, data.pageInfo.nextCursor])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
        setLogs([])
      } finally {
        setLoading(false)
      }
    },
    [tenantFilter, fromDate, toDate],
  )

  const resetAndLoad = useCallback(() => {
    const history = [undefined]
    setCursorHistory(history)
    fetchPage(0, history)
  }, [fetchPage])

  function goToNextPage() {
    fetchPage(pageIndex + 1, cursorHistory)
  }

  function goToPreviousPage() {
    fetchPage(pageIndex - 1, cursorHistory)
  }

  const loadLookups = useCallback(async () => {
    const [tenantsRes, usersRes] = await Promise.all([
      apiFetch("/tenants", { silent: true }),
      apiFetch("/users", { silent: true }),
    ])
    const tenantsData = tenantsRes.ok ? await tenantsRes.json() : []
    setTenants(Array.isArray(tenantsData) ? tenantsData : tenantsData.items ?? [])
    const usersData = usersRes.ok ? await usersRes.json() : []
    setUsers(Array.isArray(usersData) ? usersData : usersData.items ?? [])
  }, [])

  useEffect(() => {
    loadLookups()
  }, [loadLookups])

  useEffect(() => {
    resetAndLoad()
  }, [resetAndLoad])

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return logs
    return logs.filter((log) => {
      const user = log.userId ? userById.get(log.userId) : undefined
      const tenant = log.tenantId ? tenantById.get(log.tenantId) : undefined
      return [
        log.action,
        log.entityType,
        log.actorRole,
        user?.email,
        user?.firstName,
        user?.lastName,
        user ? `${user.firstName} ${user.lastName}` : undefined,
        tenant?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    })
  }, [logs, query, userById, tenantById])

  function openDetail(log: AuditLog) {
    setActiveLog(log)
    setDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operacion global</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Auditoría</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fetchPage(pageIndex, cursorHistory)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Card>
          <CardHeader className="gap-4 border-b border-border py-4">
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle>Registro de auditoría</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? "Cargando..." : `Página ${pageIndex + 1} · ${filteredLogs.length} evento${filteredLogs.length === 1 ? "" : "s"}`}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:items-end">
                <div className="space-y-2">
                  <Label>Colegio</Label>
                  <Select value={tenantFilter} onValueChange={setTenantFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los colegios</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="audit-from">Desde</Label>
                  <Input id="audit-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="audit-to">Hasta</Label>
                  <Input id="audit-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audit-search">Buscar</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="audit-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Acción, entidad, usuario o colegio..."
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-lg bg-secondary" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-3 text-base font-semibold text-foreground">No hay eventos para estos filtros</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ajusta el rango de fechas o el colegio.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Fecha</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Colegio</TableHead>
                      <TableHead className="pr-6 text-right">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const user = log.userId ? userById.get(log.userId) : undefined
                      const tenant = log.tenantId ? tenantById.get(log.tenantId) : undefined
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="pl-6 text-sm text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">{log.action}</code>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.entityType ?? "—"}</TableCell>
                          <TableCell className="text-sm text-foreground">
                            {user ? `${user.firstName} ${user.lastName}` : "Sistema"}
                            {log.actorRole && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({ROLE_LABELS[log.actorRole as keyof typeof ROLE_LABELS] ?? log.actorRole})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tenant?.name ?? "—"}</TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openDetail(log)}>
                              <Eye className="h-3.5 w-3.5" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between border-t border-border p-4">
                  <p className="text-sm text-muted-foreground">Página {pageIndex + 1}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={goToPreviousPage}
                      disabled={loading || pageIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={goToNextPage}
                      disabled={loading || !hasNextPage}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AuditLogDetailDialog open={dialogOpen} onOpenChange={setDialogOpen} log={activeLog} />
    </div>
  )
}
