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
import { Textarea } from "@/components/ui/textarea"
import {
  type CalendarEvent,
  type CalendarEventType,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  TARGET_ROLE_LABELS,
  type UserRole,
} from "@/components/shared/calendar/calendar-types"
import type { Group } from "./academic-types"

// Valor centinela para los Select: Radix no admite `value=""` en un SelectItem, y "sin
// restringir" es una opción real (audiencia = todo el colegio / todos los roles), no la
// ausencia de valor.
const ANY = "__any__"

const TARGET_ROLES: UserRole[] = ["TEACHER", "GUARDIAN", "STUDENT"]

const REMINDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ANY, label: "Sin recordatorio" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 día antes" },
  { value: "4320", label: "3 días antes" },
  { value: "10080", label: "1 semana antes" },
]

type FormState = {
  title: string
  description: string
  type: CalendarEventType
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  location: string
  targetRole: string
  groupId: string
  isSchoolDayOff: boolean
  reminderMinutesBefore: string
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toTimeInput(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyForm(day?: Date): FormState {
  const base = day ?? new Date()
  return {
    title: "",
    description: "",
    type: "INSTITUCIONAL",
    allDay: false,
    startDate: toDateInput(base),
    startTime: "08:00",
    endDate: toDateInput(base),
    endTime: "09:00",
    location: "",
    targetRole: ANY,
    groupId: ANY,
    isSchoolDayOff: false,
    reminderMinutesBefore: ANY,
  }
}

function formFromEvent(event: CalendarEvent): FormState {
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  return {
    title: event.title,
    description: event.description ?? "",
    type: event.type,
    allDay: event.allDay,
    startDate: toDateInput(start),
    startTime: toTimeInput(start),
    endDate: toDateInput(end),
    endTime: toTimeInput(end),
    location: event.location ?? "",
    targetRole: event.targetRole ?? ANY,
    groupId: event.groupId ?? ANY,
    isSchoolDayOff: event.isSchoolDayOff,
    reminderMinutesBefore:
      event.reminderMinutesBefore === null || event.reminderMinutesBefore === undefined
        ? ANY
        : String(event.reminderMinutesBefore),
  }
}

/**
 * Convierte los campos del formulario al instante que espera el API.
 *
 * Para `allDay` se manda la fecha sola como medianoche UTC: el backend la lee como fecha
 * civil y la normaliza a los límites del día en la zona del colegio (ver zonedDayBounds).
 * Mandar la medianoche local en su lugar también funciona, pero esto deja explícito que un
 * evento de todo el día es una fecha y no un instante.
 */
function toIso(dateStr: string, timeStr: string, allDay: boolean): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  if (allDay) {
    return new Date(Date.UTC(year, month - 1, day)).toISOString()
  }
  const [hour, minute] = timeStr.split(":").map(Number)
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Evento a editar; ausente = creación. */
  event?: CalendarEvent | null
  /** Día preseleccionado al crear desde una casilla de la grilla. */
  defaultDay?: Date | null
  groups: Group[]
  onSaved: (event: CalendarEvent) => void
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  defaultDay,
  groups,
  onSaved,
}: Props) {
  const isEdit = Boolean(event)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(event ? formFromEvent(event) : emptyForm(defaultDay ?? undefined))
    setError("")
  }, [open, event, defaultDay])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    setError("")

    if (!form.title.trim()) {
      setError("El título es obligatorio.")
      return
    }

    const startsAt = toIso(form.startDate, form.startTime, form.allDay)
    const endsAt = toIso(form.endDate, form.endTime, form.allDay)

    // Se valida acá además de en el servidor para no gastar un round-trip en el error más
    // común. El servidor lo revalida igual: esta comprobación es comodidad, no seguridad.
    if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      setError("El evento no puede terminar antes de empezar.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        startsAt,
        endsAt,
        allDay: form.allDay,
        location: form.location.trim() || null,
        targetRole: form.targetRole === ANY ? null : form.targetRole,
        groupId: form.groupId === ANY ? null : form.groupId,
        isSchoolDayOff: form.isSchoolDayOff,
        reminderMinutesBefore:
          form.reminderMinutesBefore === ANY ? null : Number(form.reminderMinutesBefore),
      }

      const res = await apiFetch(isEdit ? `/events/${event!.id}` : "/events", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar el evento.")
      }

      const saved = (await res.json()) as CalendarEvent
      toast.success(isEdit ? "Evento actualizado" : "Evento creado", { description: saved.title })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("No se pudo conectar con el servidor.")
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el evento.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Los cambios se ven de inmediato para quienes tienen el evento en su calendario."
              : "El evento aparece en el calendario de la audiencia que elijas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Entrega de boletines"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type">Tipo</Label>
            <Select value={form.type} onValueChange={(value) => update("type", value as CalendarEventType)}>
              <SelectTrigger id="event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {EVENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="event-all-day"
              checked={form.allDay}
              onCheckedChange={(checked) => update("allDay", checked === true)}
            />
            <Label htmlFor="event-all-day" className="font-normal">
              Todo el día
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-start-date">Desde</Label>
              <Input
                id="event-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                required
              />
              {!form.allDay && (
                <Input
                  aria-label="Hora de inicio"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => update("startTime", e.target.value)}
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end-date">Hasta</Label>
              <Input
                id="event-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => update("endDate", e.target.value)}
                required
              />
              {!form.allDay && (
                <Input
                  aria-label="Hora de fin"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => update("endTime", e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">Lugar (opcional)</Label>
            <Input
              id="event-location"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Auditorio principal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Descripción (opcional)</Label>
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-role">Dirigido a</Label>
              <Select value={form.targetRole} onValueChange={(value) => update("targetRole", value)}>
                <SelectTrigger id="event-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Todos los roles</SelectItem>
                  {TARGET_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {TARGET_ROLE_LABELS[role] ?? role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-group">Grupo</Label>
              <Select value={form.groupId} onValueChange={(value) => update("groupId", value)}>
                <SelectTrigger id="event-group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Todo el colegio</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-reminder">Recordatorio</Label>
            <Select
              value={form.reminderMinutesBefore}
              onValueChange={(value) => update("reminderMinutesBefore", value)}
            >
              <SelectTrigger id="event-reminder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-input p-3">
            <Checkbox
              id="event-day-off"
              checked={form.isSchoolDayOff}
              onCheckedChange={(checked) => update("isSchoolDayOff", checked === true)}
            />
            <div>
              <Label htmlFor="event-day-off" className="font-normal">
                Día no lectivo
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Avisa al profesor si abre asistencia ese día. No la bloquea.
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
