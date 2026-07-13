"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Tenant } from "./tenant-types"
import {
  MEMBERSHIP_STATUS_LABELS,
  ROLE_LABELS,
  USER_STATUS_LABELS,
  type Membership,
  type MembershipStatus,
  type User,
  type UserRole,
  type UserStatus,
} from "./user-types"

const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as UserRole[]
const STATUS_OPTIONS = Object.keys(USER_STATUS_LABELS) as UserStatus[]
const MEMBERSHIP_STATUS_OPTIONS = Object.keys(MEMBERSHIP_STATUS_LABELS) as MembershipStatus[]

type FormState = {
  email: string
  password: string
  firstName: string
  lastName: string
  status: UserStatus
  tenantId: string
  role: UserRole
}

const emptyForm: FormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  status: "ACTIVE",
  tenantId: "",
  role: "TENANT_ADMIN",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: User | null
  tenants: Tenant[]
  onSaved: (user: User) => void
}

export function UserFormDialog({ open, onOpenChange, user, tenants, onSaved }: Props) {
  const isEdit = Boolean(user)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [newMembershipTenantId, setNewMembershipTenantId] = useState("")
  const [newMembershipRole, setNewMembershipRole] = useState<UserRole>("TENANT_ADMIN")
  const [addingMembership, setAddingMembership] = useState(false)

  useEffect(() => {
    if (!open) return
    if (user) {
      setForm({
        email: user.email,
        password: "",
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        tenantId: "",
        role: "TENANT_ADMIN",
      })
      setMemberships(user.memberships)
    } else {
      setForm(emptyForm)
      setMemberships([])
    }
    setNewMembershipTenantId("")
    setError("")
  }, [open, user])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setError("Correo, nombre y apellido son obligatorios.")
      return
    }
    if (!isEdit && form.password.trim().length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = isEdit
        ? {
            email: form.email.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            status: form.status,
            password: form.password.trim() || undefined,
          }
        : {
            email: form.email.trim(),
            password: form.password.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            status: form.status,
            tenantId: form.tenantId || undefined,
            role: form.tenantId ? form.role : undefined,
          }

      const res = await apiFetch(isEdit ? `/users/${user!.id}` : "/users", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar el usuario.")
      }

      const saved = (await res.json()) as User
      toast.success(isEdit ? "Usuario actualizado" : "Usuario creado", {
        description: `${saved.firstName} ${saved.lastName}`,
      })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el usuario.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddMembership() {
    if (!user || !newMembershipTenantId) return
    setAddingMembership(true)
    try {
      const res = await apiFetch(`/users/${user.id}/memberships`, {
        method: "POST",
        body: JSON.stringify({ tenantId: newMembershipTenantId, role: newMembershipRole }),
        silent: true,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo agregar la membresía.")
      }
      const membership = (await res.json()) as Membership
      const next = [...memberships, membership]
      setMemberships(next)
      onSaved({ ...user, memberships: next })
      setNewMembershipTenantId("")
      toast.success("Membresía agregada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar la membresía.")
    } finally {
      setAddingMembership(false)
    }
  }

  async function handleUpdateMembership(membership: Membership, patch: Partial<Pick<Membership, "role" | "status">>) {
    if (!user) return
    try {
      const res = await apiFetch(`/users/${user.id}/memberships/${membership.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        silent: true,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo actualizar la membresía.")
      }
      const updated = (await res.json()) as Membership
      const next = memberships.map((m) => (m.id === updated.id ? updated : m))
      setMemberships(next)
      onSaved({ ...user, memberships: next })
      toast.success("Membresía actualizada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la membresía.")
    }
  }

  const availableTenantsForNewMembership = tenants.filter(
    (tenant) => !memberships.some((m) => m.tenant.id === tenant.id),
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos de la cuenta y gestiona sus membresías por colegio."
              : "Crea una cuenta global. Puedes asignarla a un colegio ahora o después."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-first-name">Nombre</Label>
              <Input
                id="user-first-name"
                value={form.firstName}
                onChange={(event) => setForm((c) => ({ ...c, firstName: event.target.value }))}
                placeholder="Juan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-last-name">Apellido</Label>
              <Input
                id="user-last-name"
                value={form.lastName}
                onChange={(event) => setForm((c) => ({ ...c, lastName: event.target.value }))}
                placeholder="López"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">Correo</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))}
              placeholder="usuario@colegio.com"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-password">{isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((c) => ({ ...c, password: event.target.value }))}
                placeholder="Mínimo 8 caracteres"
                required={!isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-status">Estado</Label>
              <Select value={form.status} onValueChange={(value) => setForm((c) => ({ ...c, status: value as UserStatus }))}>
                <SelectTrigger id="user-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {USER_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">Asignar a un colegio (opcional)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={form.tenantId} onValueChange={(value) => setForm((c) => ({ ...c, tenantId: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin colegio" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm((c) => ({ ...c, role: value as UserRole }))}
                  disabled={!form.tenantId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>

        {isEdit && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Membresías por colegio</p>

            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este usuario no pertenece a ningún colegio todavía.</p>
            ) : (
              <div className="space-y-2">
                {memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="min-w-0 truncate text-sm font-medium text-foreground">{membership.tenant.name}</p>
                    <div className="flex shrink-0 gap-2">
                      <Select
                        value={membership.role}
                        onValueChange={(value) => handleUpdateMembership(membership, { role: value as UserRole })}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={membership.status}
                        onValueChange={(value) => handleUpdateMembership(membership, { status: value as MembershipStatus })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEMBERSHIP_STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {MEMBERSHIP_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {availableTenantsForNewMembership.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2.5 sm:flex-row sm:items-center">
                <Select value={newMembershipTenantId} onValueChange={setNewMembershipTenantId}>
                  <SelectTrigger className="h-8 w-full text-xs sm:flex-1">
                    <SelectValue placeholder="Selecciona un colegio" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTenantsForNewMembership.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newMembershipRole} onValueChange={(value) => setNewMembershipRole(value as UserRole)}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleAddMembership}
                  disabled={!newMembershipTenantId || addingMembership}
                >
                  {addingMembership ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Agregar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
