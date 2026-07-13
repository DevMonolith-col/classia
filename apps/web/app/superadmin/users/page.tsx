"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Pencil, Plus, RefreshCw, Search, Users } from "lucide-react"
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
import { UserFormDialog } from "@/components/superadmin/user-form-dialog"
import type { Tenant } from "@/components/superadmin/tenant-types"
import { ROLE_LABELS, USER_STATUS_CLASSNAME, USER_STATUS_LABELS, type User } from "@/components/superadmin/user-types"

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [usersRes, tenantsRes] = await Promise.all([
        apiFetch("/users", { silent: true }),
        apiFetch("/tenants", { silent: true }),
      ])

      if (!usersRes.ok) {
        throw new Error(usersRes.status === 403 ? "No tienes permiso para ver los usuarios." : "No se pudo cargar el listado de usuarios.")
      }

      setUsers(((await usersRes.json()) as User[]) ?? [])
      setTenants(tenantsRes.ok ? (((await tenantsRes.json()) as Tenant[]) ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter((user) =>
      [user.email, user.firstName, user.lastName, ...user.memberships.map((m) => m.tenant.name)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [query, users])

  function openCreateDialog() {
    setEditingUser(null)
    setDialogOpen(true)
  }

  function openEditDialog(user: User) {
    setEditingUser(user)
    setDialogOpen(true)
  }

  function handleSaved(saved: User) {
    setUsers((current) => {
      const exists = current.some((user) => user.id === saved.id)
      if (exists) return current.map((user) => (user.id === saved.id ? saved : user))
      return [...current, saved]
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
            <Button variant="outline" size="sm" className="gap-2" onClick={loadAll} disabled={loading}>
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
          <CardHeader className="gap-4 border-b border-border">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Usuarios registrados</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? "Cargando..." : `${users.length} usuario${users.length === 1 ? "" : "s"} en la plataforma`}
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre, correo o colegio"
                  className="h-9 w-full pl-9 sm:w-72"
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
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-3 text-base font-semibold text-foreground">
                  {users.length === 0 ? "Aún no hay usuarios registrados" : "No hay usuarios para este filtro"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {users.length === 0 ? "Crea el primer usuario para empezar." : "Ajusta la búsqueda o crea un nuevo usuario."}
                </p>
                {users.length === 0 && (
                  <Button className="mt-4 gap-2" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                    Nuevo usuario
                  </Button>
                )}
              </div>
            ) : (
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
                  {filteredUsers.map((user) => (
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
                        {user.memberships.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin colegio</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {user.memberships.map((membership) => (
                              <Badge key={membership.id} variant="outline" className="gap-1 font-normal">
                                {membership.tenant.name} · {ROLE_LABELS[membership.role]}
                              </Badge>
                            ))}
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
