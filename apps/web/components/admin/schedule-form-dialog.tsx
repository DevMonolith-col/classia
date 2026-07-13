"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2, User } from "lucide-react"
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
import { DAY_LABELS, type Group, type Schedule, type Subject, type Teacher } from "./academic-types"
import { TimeSelect } from "./time-select"

type FormState = {
  groupId: string
  subjectId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
}

const emptyForm: FormState = {
  groupId: "",
  subjectId: "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "09:00",
  room: "",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: Schedule | null
  teacher: Teacher
  groups: Group[]
  subjects: Subject[]
  onSaved: (schedule: Schedule) => void
  onChangeTeacher?: () => void
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  schedule,
  teacher,
  groups,
  subjects,
  onSaved,
  onChangeTeacher,
}: Props) {
  const isEdit = Boolean(schedule)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    if (schedule) {
      setForm({
        groupId: schedule.group.id,
        subjectId: schedule.subject.id,
        dayOfWeek: String(schedule.dayOfWeek),
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room ?? "",
      })
    } else {
      setForm(emptyForm)
    }
    setError("")
  }, [open, schedule])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (!form.groupId || !form.subjectId) {
      setError("Grupo y materia son obligatorios.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        groupId: form.groupId,
        subjectId: form.subjectId,
        teacherId: teacher.id,
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room.trim() || undefined,
      }

      const res = await apiFetch(isEdit ? `/schedules/${schedule!.id}` : "/schedules", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar el horario.")
      }

      const saved = (await res.json()) as Schedule
      toast.success(isEdit ? "Horario actualizado" : "Horario creado", {
        description: `${saved.subject.name} · ${DAY_LABELS[saved.dayOfWeek]} ${saved.startTime}-${saved.endTime}`,
      })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el horario.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar horario" : "Nuevo horario"}</DialogTitle>
          <DialogDescription>
            Se valida que no se solapen clases del grupo ni del profesor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <User className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Profesor</p>
              <p className="truncate text-sm font-medium text-foreground">
                {teacher.user.firstName} {teacher.user.lastName}
              </p>
            </div>
          </div>
          {onChangeTeacher && (
            <Button type="button" variant="ghost" size="sm" onClick={onChangeTeacher} disabled={submitting}>
              Cambiar
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-group">Grupo</Label>
              <Select value={form.groupId} onValueChange={(value) => setForm((c) => ({ ...c, groupId: value }))}>
                <SelectTrigger id="schedule-group" className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-subject">Materia</Label>
              <Select value={form.subjectId} onValueChange={(value) => setForm((c) => ({ ...c, subjectId: value }))}>
                <SelectTrigger id="schedule-subject" className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="space-y-2 sm:w-40 sm:shrink-0">
              <Label htmlFor="schedule-day">Día</Label>
              <Select value={form.dayOfWeek} onValueChange={(value) => setForm((c) => ({ ...c, dayOfWeek: value }))}>
                <SelectTrigger id="schedule-day" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DAY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Label>Horario</Label>
              <div className="flex flex-wrap items-center gap-2">
                <TimeSelect
                  value={form.startTime}
                  onChange={(value) => setForm((c) => ({ ...c, startTime: value }))}
                />
                <span className="text-sm text-muted-foreground">a</span>
                <TimeSelect
                  value={form.endTime}
                  onChange={(value) => setForm((c) => ({ ...c, endTime: value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-room">Aula (opcional)</Label>
            <Input
              id="schedule-room"
              value={form.room}
              onChange={(event) => setForm((c) => ({ ...c, room: event.target.value }))}
              placeholder="Aula 101"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear horario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
