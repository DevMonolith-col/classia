"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Switch } from "@/components/ui/switch"
import type { Group } from "./academic-types"
import type { Guardian, Student } from "./student-types"

type FormState = {
  firstName: string
  lastName: string
  documentId: string
  birthDate: string
  groupId: string
  isActive: boolean
  guardianIds: string[]
}

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  documentId: "",
  birthDate: "",
  groupId: "",
  isActive: true,
  guardianIds: [],
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  student?: Student | null
  groups: Group[]
  guardians: Guardian[]
  onSaved: (student: Student) => void
}

export function StudentFormDialog({ open, onOpenChange, student, groups, guardians, onSaved }: Props) {
  const isEdit = Boolean(student)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(
      student
        ? {
            firstName: student.firstName,
            lastName: student.lastName,
            documentId: student.documentId ?? "",
            birthDate: student.birthDate ? student.birthDate.slice(0, 10) : "",
            groupId: student.group?.id ?? "",
            isActive: student.isActive,
            guardianIds: student.guardians.map((link) => link.guardian.id),
          }
        : emptyForm,
    )
    setError("")
  }, [open, student])

  function toggleGuardian(guardianId: string) {
    setForm((current) => ({
      ...current,
      guardianIds: current.guardianIds.includes(guardianId)
        ? current.guardianIds.filter((id) => id !== guardianId)
        : [...current.guardianIds, guardianId],
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Nombre y apellido son obligatorios.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        documentId: form.documentId.trim() || undefined,
        birthDate: form.birthDate || undefined,
        groupId: form.groupId || null,
        isActive: form.isActive,
        guardianIds: form.guardianIds,
      }

      const res = await apiFetch(isEdit ? `/students/${student!.id}` : "/students", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar el estudiante.")
      }

      const saved = (await res.json()) as Student
      toast.success(isEdit ? "Estudiante actualizado" : "Estudiante creado", {
        description: `${saved.firstName} ${saved.lastName}`,
      })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el estudiante.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar estudiante" : "Nuevo estudiante"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Actualiza los datos del estudiante." : "Registra un nuevo estudiante en el colegio."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-first-name">Nombre</Label>
              <Input
                id="student-first-name"
                value={form.firstName}
                onChange={(event) => setForm((c) => ({ ...c, firstName: event.target.value }))}
                placeholder="María"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-last-name">Apellido</Label>
              <Input
                id="student-last-name"
                value={form.lastName}
                onChange={(event) => setForm((c) => ({ ...c, lastName: event.target.value }))}
                placeholder="García López"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-document">Documento (opcional)</Label>
              <Input
                id="student-document"
                value={form.documentId}
                onChange={(event) => setForm((c) => ({ ...c, documentId: event.target.value }))}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-birth-date">Fecha de nacimiento (opcional)</Label>
              <Input
                id="student-birth-date"
                type="date"
                value={form.birthDate}
                onChange={(event) => setForm((c) => ({ ...c, birthDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-group">Curso</Label>
            <Select
              value={form.groupId || "__none__"}
              onValueChange={(value) => setForm((c) => ({ ...c, groupId: value === "__none__" ? "" : value }))}
            >
              <SelectTrigger id="student-group" className="w-full">
                <SelectValue placeholder="Sin curso asignado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin curso asignado</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Estudiante activo</p>
              <p className="text-xs text-muted-foreground">Los estudiantes inactivos no aparecen en listados operativos.</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((c) => ({ ...c, isActive: checked }))} />
          </div>

          <div className="space-y-2">
            <Label>Acudientes (opcional)</Label>
            {guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay acudientes registrados en el colegio para vincular.
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {guardians.map((guardian) => (
                  <label key={guardian.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.guardianIds.includes(guardian.id)}
                      onCheckedChange={() => toggleGuardian(guardian.id)}
                    />
                    <span className="text-foreground">
                      {guardian.user.firstName} {guardian.user.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{guardian.user.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear estudiante"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
