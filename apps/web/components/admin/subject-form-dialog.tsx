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
import type { Subject } from "./academic-types"

type FormState = {
  name: string
  code: string
}

const emptyForm: FormState = { name: "", code: "" }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject?: Subject | null
  onSaved: (subject: Subject) => void
}

export function SubjectFormDialog({ open, onOpenChange, subject, onSaved }: Props) {
  const isEdit = Boolean(subject)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(subject ? { name: subject.name, code: subject.code ?? "" } : emptyForm)
    setError("")
  }, [open, subject])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (!form.name.trim()) {
      setError("El nombre es obligatorio.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
      }

      const res = await apiFetch(isEdit ? `/subjects/${subject!.id}` : "/subjects", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la materia.")
      }

      const saved = (await res.json()) as Subject
      toast.success(isEdit ? "Materia actualizada" : "Materia creada", { description: saved.name })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar la materia.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar materia" : "Nueva materia"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Actualiza el nombre o código de la materia." : "Crea una materia para asignarla en los horarios."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject-name">Nombre</Label>
            <Input
              id="subject-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Matemáticas"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject-code">Código (opcional)</Label>
            <Input
              id="subject-code"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="MAT-01"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear materia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
