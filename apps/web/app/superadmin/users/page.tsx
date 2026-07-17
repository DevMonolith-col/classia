"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search, Users, X } from "lucide-react"
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
import { UserFormDialog } from "@/components/superadmin/user-form-dialog"
import type { Tenant } from "@/components/superadmin/tenant-types"
import { ROLE_LABELS, USER_STATUS_CLASSNAME, USER_STATUS_LABELS, type User, type UsersResponse } from "@/components/superadmin/user-types"

const PAGE_SIZE = 10

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "all") search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  
  const [tenantFilter, setTenantFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  
  const [hasNextPage, setHasNextPage] = useState(false)
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 500)
    return () => clearTimeout(handler)
  }, [query])

  const loadTenants = useCallback(async () => {
    try {
      const res = await apiFetch("/tenants", { silent: true })
      if (res.ok) {
        setTenants((await res.json()) as Tenant[])
      }
    } catch {
      // Ignored
    }
  }, [])

  const fetchPage = useCallback(
    async (
      index: number,
      history: (string | undefined)[],
      searchQuery: string,
      tenantId: string,
      role: string,
      status: string
    ) => {
      setLoading(true)
      setError("")

      try {
        const qs = buildQuery({
          limit: String(PAGE_SIZE),
          cursor: history[index],
          search: searchQuery,
          tenantId: tenantId === "all" ? undefined : tenantId,
          role: role === "all" ? undefined : role,
          status: status === "all" ? undefined : status,
        })

        const res = await apiFetch(`/users${qs}`, { silent: true })
        if (!res.ok) {
          throw new Error(res.status === 403 ? "No tienes permiso para ver los usuarios." : "No se pudo cargar el listado de usuarios.")
        }

        const data = (await res.json()) as UsersResponse
        setUsers(data.items)
        setHasNextPage(data.pageInfo.hasNextPage)
        setPageIndex(index)
        
        if (data.pageInfo.nextCursor && history.length === index + 1) {
          setCursorHistory([...history, data.pageInfo.nextCursor])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
        setUsers([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const resetAndLoad = useCallback(() => {
    const history = [undefined]
    setCursorHistory(history)
    fetchPage(0, history, debouncedQuery, tenantFilter, roleFilter, statusFilter)
  }, [debouncedQuery, tenantFilter, roleFilter, statusFilter, fetchPage])

  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  useEffect(() => {
    resetAndLoad()
  }, [resetAndLoad])

  function goToNextPage() {
    fetchPage(pageIndex + 1, cursorHistory, debouncedQuery, tenantFilter, roleFilter, statusFilter)
  }

  function goToPreviousPage() {
    fetchPage(pageIndex - 1, cursorHistory, debouncedQuery, tenantFilter, roleFilter, statusFilter)
  }

  function openCreateDialog() {
    setEditingUser(null)
    setDialogOpen(true)
  }

  function openEditDialog(user: User) {
    setEditingUser(user)
    setDialogOpen(true)
  }

  const hasActiveFilters = tenantFilter !== "all" || roleFilter !== "all" || statusFilter !== "all" || query !== ""

  function clearFilters() {
    setTenantFilter("all")
    setRoleFilter("all")
    setStatusFilter("all")
    setQuery("")
  }

  function handleSaved(saved: User) {
    setUsers((current) => {
      const exists = current.some((u) => u.id === saved.id)
      if (exists) return current.map((u) => (u.id === saved.id ? saved : u))
      return [saved, ...current]
    })
    setEditingUser((current) => (current && current.id === saved.id ? saved : current))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operacion global</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Usuarios globales</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" size="sm" className="gap-2" onClick={resetAndLoad} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Nuevo usuario
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

        <Card>
          <CardHeader className="gap-4 border-b border-border py-4">
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle>Usuarios Registrados</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? "Cargando..." : `Página ${pageIndex + 1} - ${users.length} usuario${users.length === 1 ? "" : "s"} visibles`}
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
                  <Label>Rol en plataforma</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Estado de cuenta</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Cualquier estado</SelectItem>
                      {Object.entries(USER_STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Búsqueda</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por nombre o correo"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div>
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" />
                    Eliminar filtros
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && users.length === 0 ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-3 text-base font-semibold text-foreground">
                  No hay usuarios para estos filtros
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajusta la búsqueda, el colegio o los permisos.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Usuario</TableHead>
                      <TableHead>Colegios</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="pr-6 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                              {user.firstName.slice(0, 1).toUpperCase()}
                              {user.lastName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.memberships.some((m) => m.role === "SUPER_ADMIN") ? (
                            <Badge 
                              variant="secondary" 
                              className="font-normal bg-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 border-transparent"
                            >
                              <span className="font-medium mr-1">Acceso global</span>
                              <span className="opacity-70">· Todos los colegios</span>
                            </Badge>
                          ) : user.memberships.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sin colegio</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {user.memberships.slice(0, 2).map((membership) => (
                                <Badge 
                                  key={membership.id} 
                                  variant="outline" 
                                  className="font-normal text-foreground/80"
                                >
                                  <span className="font-medium mr-1">{membership.tenant.name}</span>
                                  <span className="opacity-70">· {ROLE_LABELS[membership.role] ?? membership.role}</span>
                                </Badge>
                              ))}
                              {user.memberships.length > 2 && (
                                <Badge variant="secondary" className="font-normal text-xs text-muted-foreground">
                                  +{user.memberships.length - 2} más
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={USER_STATUS_CLASSNAME[user.status]}>
                            {USER_STATUS_LABELS[user.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(user)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        tenants={tenants}
        onSaved={handleSaved}
      />
    </div>
  )
}
