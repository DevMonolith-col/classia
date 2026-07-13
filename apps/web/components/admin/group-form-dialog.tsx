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
import type { Group } from "./academic-types"

type FormState = {
  name: string
  grade: string
  section: string
}

const emptyForm: FormState = { name: "", grade: "", section: "" }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: Group | null
  onSaved: (group: Group) => void
}

export function GroupFormDialog({ open, onOpenChange, group, onSaved }: Props) {
  const isEdit = Boolean(group)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(group ? { name: group.name, grade: group.grade, section: group.section } : emptyForm)
    setError("")
  }, [open, group])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (!form.name.trim() || !form.grade.trim() || !form.section.trim()) {
      setError("Nombre, grado y sección son obligatorios.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        grade: form.grade.trim(),
        section: form.section.trim(),
      }

      const res = await apiFetch(isEdit ? `/groups/${group!.id}` : "/groups", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar el curso.")
      }

      const saved = (await res.json()) as Group
      toast.success(isEdit ? "Curso actualizado" : "Curso creado", { description: saved.name })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el curso.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar curso" : "Nuevo curso"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Actualiza el nombre, grado o sección del curso." : "Crea un curso para agrupar estudiantes, horarios y asistencia."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Nombre</Label>
            <Input
              id="group-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="5to Grado A"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="group-grade">Grado</Label>
              <Input
                id="group-grade"
                value={form.grade}
                onChange={(event) => setForm((current) => ({ ...current, grade: event.target.value }))}
                placeholder="5to Grado"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-section">Sección</Label>
              <Input
                id="group-section"
                value={form.section}
                onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}
                placeholder="A"
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear curso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
