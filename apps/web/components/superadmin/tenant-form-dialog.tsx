"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
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
import type { Tenant, TenantStatus } from "./tenant-types"

const statusOptions: { value: TenantStatus; label: string }[] = [
  { value: "DEMO", label: "Demo" },
  { value: "PILOT", label: "Piloto" },
  { value: "ACTIVE", label: "Activo" },
  { value: "SUSPENDED", label: "Suspendido" },
  { value: "CANCELLED", label: "Cancelado" },
]

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

type FormState = {
  name: string
  slug: string
  primaryDomain: string
  status: TenantStatus
  logoUrl: string
  brandColor: string
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  primaryDomain: "",
  status: "DEMO",
  logoUrl: "",
  brandColor: "",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: Tenant | null
  onSaved: (tenant: Tenant) => void
}

export function TenantFormDialog({ open, onOpenChange, tenant, onSaved }: Props) {
  const isEdit = Boolean(tenant)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [slugTouched, setSlugTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    if (tenant) {
      setForm({
        name: tenant.name,
        slug: tenant.slug,
        primaryDomain: tenant.primaryDomain ?? "",
        status: tenant.status ?? "DEMO",
        logoUrl: tenant.logoUrl ?? "",
        brandColor: tenant.brandColor ?? "",
      })
      setSlugTouched(true)
    } else {
      setForm(emptyForm)
      setSlugTouched(false)
    }
    setError("")
  }, [open, tenant])

  function handleNameChange(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugify(value),
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (!form.name.trim() || !form.slug.trim()) {
      setError("Nombre y slug son obligatorios.")
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        primaryDomain: form.primaryDomain.trim() || undefined,
        status: form.status,
        logoUrl: form.logoUrl.trim() || undefined,
        brandColor: form.brandColor.trim() || undefined,
      }
      if (!isEdit) payload.slug = form.slug.trim()

      const res = await apiFetch(isEdit ? `/tenants/${tenant!.id}` : "/tenants", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar el colegio.")
      }

      const saved = (await res.json()) as Tenant
      toast.success(isEdit ? "Colegio actualizado" : "Colegio creado", {
        description: saved.name,
      })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el colegio.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar colegio" : "Nuevo colegio"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos del tenant. El slug no puede modificarse una vez creado."
              : "Crea un nuevo tenant. El slug identifica al colegio en encabezados y subdominios."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Nombre</Label>
            <Input
              id="tenant-name"
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Colegio San José"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-slug">Slug</Label>
            <Input
              id="tenant-slug"
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true)
                setForm((current) => ({ ...current, slug: slugify(event.target.value) }))
              }}
              placeholder="colegio-san-jose"
              disabled={isEdit}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minúsculas, números y guiones (3-50 caracteres). Se usa en el header X-Tenant-Slug y subdominios.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-domain">Dominio principal</Label>
              <Input
                id="tenant-domain"
                value={form.primaryDomain}
                onChange={(event) =>
                  setForm((current) => ({ ...current, primaryDomain: event.target.value }))
                }
                placeholder="app.san-jose.classia.com.co"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-status">Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as TenantStatus }))
                }
              >
                <SelectTrigger id="tenant-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-logo">Logo (URL)</Label>
              <Input
                id="tenant-logo"
                value={form.logoUrl}
                onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))}
                placeholder="https://cdn.classia.com/logo.png"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-brand">Color de marca</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tenant-brand"
                  value={form.brandColor}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, brandColor: event.target.value }))
                  }
                  placeholder="#212121"
                  maxLength={20}
                />
                <span
                  className="h-9 w-9 shrink-0 rounded-md border border-border"
                  style={{
                    backgroundColor: /^#([0-9a-f]{3}){1,2}$/i.test(form.brandColor)
                      ? form.brandColor
                      : "transparent",
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear colegio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
