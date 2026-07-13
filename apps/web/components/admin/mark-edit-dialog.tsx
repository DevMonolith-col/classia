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
import { Switch } from "@/components/ui/switch"
import type { Mark } from "./marks-types"

type FormState = {
  title: string
  value: string
  maxValue: string
  period: string
  isPublished: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mark: Mark | null
  onSaved: (mark: Mark) => void
}

export function MarkEditDialog({ open, onOpenChange, mark, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({ title: "", value: "", maxValue: "", period: "1", isPublished: true })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !mark) return
    setForm({
      title: mark.title,
      value: String(mark.value),
      maxValue: String(mark.maxValue),
      period: String(mark.period),
      isPublished: mark.isPublished,
    })
    setError("")
  }, [open, mark])

  if (!mark) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    const value = Number(form.value)
    const maxValue = Number(form.maxValue)
    if (!form.title.trim() || Number.isNaN(value) || Number.isNaN(maxValue)) {
      setError("Completa el título y valores numéricos válidos.")
      return
    }
    if (value > maxValue) {
      setError("El valor no puede superar el máximo.")
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch(`/marks/${mark!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title.trim(),
          value,
          maxValue,
          period: Number(form.period),
          isPublished: form.isPublished,
        }),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la calificación.")
      }

      const saved = (await res.json()) as Mark
      toast.success("Calificación actualizada")
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar la calificación.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar calificación</DialogTitle>
          <DialogDescription>
            {mark.student.firstName} {mark.student.lastName} · {mark.subject.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mark-edit-title">Título</Label>
            <Input
              id="mark-edit-title"
              value={form.title}
              onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="mark-edit-value">Valor</Label>
              <Input
                id="mark-edit-value"
                type="number"
                min={0}
                step="0.1"
                value={form.value}
                onChange={(event) => setForm((c) => ({ ...c, value: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mark-edit-max">Máximo</Label>
              <Input
                id="mark-edit-max"
                type="number"
                min={1}
                value={form.maxValue}
                onChange={(event) => setForm((c) => ({ ...c, maxValue: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mark-edit-period">Periodo</Label>
              <Input
                id="mark-edit-period"
                type="number"
                min={1}
                max={12}
                value={form.period}
                onChange={(event) => setForm((c) => ({ ...c, period: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Publicada</p>
              <p className="text-xs text-muted-foreground">Visible para acudientes y estudiantes.</p>
            </div>
            <Switch
              checked={form.isPublished}
              onCheckedChange={(checked) => setForm((c) => ({ ...c, isPublished: checked }))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
