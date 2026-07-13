"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, Lock, LockOpen, Users } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_SHORT,
  STATUS_ORDER,
  type AttendanceSession,
  type AttendanceStatus,
} from "./attendance-types"

type DraftRecord = { status: AttendanceStatus; observation: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: AttendanceSession | null
  onUpdated: (session: AttendanceSession) => void
}

export function AttendanceSessionDialog({ open, onOpenChange, session, onUpdated }: Props) {
  const [draft, setDraft] = useState<Record<string, DraftRecord>>({})
  const [submitting, setSubmitting] = useState(false)
  const [togglingOpen, setTogglingOpen] = useState(false)

  useEffect(() => {
    if (!open || !session) return
    setDraft(
      Object.fromEntries(
        session.records.map((record) => [
          record.studentId,
          { status: record.status, observation: record.observation ?? "" },
        ]),
      ),
    )
  }, [open, session])

  if (!session) return null

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDraft((current) => ({
      ...current,
      [studentId]: { status, observation: status === "PRESENT" ? "" : (current[studentId]?.observation ?? "") },
    }))
  }

  function setObservation(studentId: string, observation: string) {
    setDraft((current) => ({ ...current, [studentId]: { ...current[studentId], observation } }))
  }

  async function handleSave() {
    if (!session) return
    setSubmitting(true)
    try {
      const records = Object.entries(draft).map(([studentId, value]) => ({
        studentId,
        status: value.status,
        observation: value.observation.trim() || undefined,
      }))

      const res = await apiFetch(`/attendance/sessions/${session.id}/records`, {
        method: "PUT",
        body: JSON.stringify({ records }),
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo guardar la asistencia.")
      }

      const updated = (await res.json()) as AttendanceSession
      toast.success("Asistencia actualizada")
      onUpdated(updated)
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleOpen() {
    if (!session) return
    setTogglingOpen(true)
    try {
      const res = await apiFetch(`/attendance/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isOpen: !session.isOpen }),
        silent: true,
      })
      if (!res.ok) throw new Error("No se pudo actualizar el estado de la sesión.")
      const updated = (await res.json()) as AttendanceSession
      toast.success(updated.isOpen ? "Asistencia reabierta" : "Asistencia cerrada")
      onUpdated(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setTogglingOpen(false)
    }
  }

  function markAllPresent() {
    setDraft((current) => {
      const next: Record<string, DraftRecord> = {}
      for (const studentId of Object.keys(current)) next[studentId] = { status: "PRESENT", observation: "" }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>
                {session.group.name} · {session.schedule?.subject.name ?? "—"}
              </DialogTitle>
              <DialogDescription>
                {session.teacher.user.firstName} {session.teacher.user.lastName} ·{" "}
                {new Date(session.date).toLocaleDateString("es-CO", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </DialogDescription>
            </div>
            <Badge variant={session.isOpen ? "outline" : "secondary"} className="shrink-0 gap-1.5">
              {session.isOpen ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {session.isOpen ? "Abierta" : "Cerrada"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4" />
            Estudiantes ({session.records.length})
          </p>
          <div className="flex items-center gap-2">
            {session.isOpen && (
              <Button variant="outline" size="sm" className="gap-2" onClick={markAllPresent}>
                <CheckCircle2 className="h-4 w-4" />
                Marcar todos presentes
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={toggleOpen} disabled={togglingOpen}>
              {togglingOpen && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {session.isOpen ? "Cerrar" : "Reabrir"}
            </Button>
          </div>
        </div>

        <div className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {session.records.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Este grupo no tiene estudiantes activos.</p>
            </div>
          ) : (
            session.records.map((record) => {
              const value = draft[record.studentId] ?? { status: record.status, observation: record.observation ?? "" }
              return (
                <div key={record.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {record.student.firstName} {record.student.lastName}
                    </p>
                    {record.student.documentId && (
                      <p className="text-xs text-muted-foreground">{record.student.documentId}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1.5">
                      {STATUS_ORDER.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={!session.isOpen}
                          onClick={() => setStatus(record.studentId, status)}
                          title={ATTENDANCE_STATUS_LABELS[status]}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            value.status === status
                              ? ATTENDANCE_STATUS_COLORS[status]
                              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                          }`}
                        >
                          {ATTENDANCE_STATUS_SHORT[status]}
                        </button>
                      ))}
                    </div>
                    {value.status !== "PRESENT" && (
                      <Input
                        value={value.observation}
                        onChange={(event) => setObservation(record.studentId, event.target.value)}
                        placeholder="Observación"
                        disabled={!session.isOpen}
                        className="h-7 w-40 text-xs"
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {session.isOpen && session.records.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
