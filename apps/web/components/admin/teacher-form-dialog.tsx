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
import type { Teacher } from "./academic-types"

type FormState = {
  firstName: string
  lastName: string
  email: string
  password: string
}

const emptyForm: FormState = { firstName: "", lastName: "", email: "", password: "" }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher?: Teacher | null
  onSaved: (teacher: Teacher) => void
}

export function TeacherFormDialog({ open, onOpenChange, teacher, onSaved }: Props) {
  const isEdit = Boolean(teacher)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(
      teacher
        ? { firstName: teacher.user.firstName, lastName: teacher.user.lastName, email: teacher.user.email, password: "" }
        : emptyForm,
    )
    setError("")
  }, [open, teacher])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Nombre, apellido y correo son obligatorios.")
      return
    }
    if (!isEdit && form.password.trim().length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (isEdit && form.password.trim() && form.password.trim().length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        const res = await apiFetch(`/users/${teacher!.user.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            password: form.password.trim() || undefined,
          }),
          silent: true,
        })

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
          const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
          throw new Error(message || "No se pudo actualizar el profesor.")
        }

        const user = (await res.json()) as Teacher["user"]
        const saved: Teacher = { ...teacher!, user: { ...teacher!.user, ...user } }
        toast.success("Profesor actualizado", { description: `${saved.user.firstName} ${saved.user.lastName}` })
        onSaved(saved)
        onOpenChange(false)
        return
      }

      const userRes = await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: "TEACHER",
        }),
        silent: true,
      })

      if (!userRes.ok) {
        const body = (await userRes.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo crear la cuenta del profesor.")
      }

      const user = (await userRes.json()) as { id: string }

      const teacherRes = await apiFetch("/teachers", {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
        silent: true,
      })

      if (!teacherRes.ok) {
        const body = (await teacherRes.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "El usuario se creó, pero no se pudo generar el perfil de profesor.")
      }

      const saved = (await teacherRes.json()) as Teacher
      toast.success("Profesor creado", { description: `${saved.user.firstName} ${saved.user.lastName}` })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el profesor.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar profesor" : "Nuevo profesor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos de la cuenta del profesor."
              : "Crea la cuenta del profesor y su perfil docente. Podrá iniciar sesión con este correo y contraseña."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-first-name">Nombre</Label>
              <Input
                id="teacher-first-name"
                value={form.firstName}
                onChange={(event) => setForm((c) => ({ ...c, firstName: event.target.value }))}
                placeholder="María"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-last-name">Apellido</Label>
              <Input
                id="teacher-last-name"
                value={form.lastName}
                onChange={(event) => setForm((c) => ({ ...c, lastName: event.target.value }))}
                placeholder="García Rodríguez"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-email">Correo</Label>
            <Input
              id="teacher-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))}
              placeholder="profesor@colegio.edu"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-password">{isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
            <Input
              id="teacher-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((c) => ({ ...c, password: event.target.value }))}
              placeholder="Mínimo 8 caracteres"
              required={!isEdit}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear profesor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
