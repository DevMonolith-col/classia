"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, Eye, Lock, LockOpen, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AttendanceSessionDialog } from "@/components/admin/attendance-session-dialog"
import { TeacherCombobox } from "@/components/admin/teacher-combobox"
import { ATTENDANCE_STATUS_LABELS, type AttendanceSession, type AttendanceStatus } from "@/components/admin/attendance-types"
import type { Teacher } from "@/components/admin/academic-types"

type StatusFilter = "all" | "open" | "closed"

function countByStatus(session: AttendanceSession) {
  const counts: Record<AttendanceStatus, number> = {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    JUSTIFIED: 0,
    PERMISSION: 0,
  }
  for (const record of session.records) counts[record.status]++
  return counts
}

export default function AdminAsistenciaPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [sessionsRes, teachersRes] = await Promise.all([
        apiFetch("/attendance/sessions", { silent: true }),
        apiFetch("/teachers", { silent: true }),
      ])

      if (!sessionsRes.ok) {
        throw new Error(sessionsRes.status === 403 ? "No tienes permiso para ver la asistencia." : "No se pudo cargar la asistencia.")
      }

      setSessions(((await sessionsRes.json()) as AttendanceSession[]) ?? [])
      setTeachers(teachersRes.ok ? (((await teachersRes.json()) as Teacher[]) ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filteredSessions = useMemo(() => {
    let list = sessions
    if (selectedTeacherId) list = list.filter((s) => s.teacher.id === selectedTeacherId)
    if (statusFilter === "open") list = list.filter((s) => s.isOpen)
    if (statusFilter === "closed") list = list.filter((s) => !s.isOpen)
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [sessions, selectedTeacherId, statusFilter])

  function openSessionDialog(session: AttendanceSession) {
    setActiveSession(session)
    setDialogOpen(true)
  }

  function handleUpdated(updated: AttendanceSession) {
    setSessions((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    setActiveSession(updated)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asistencia</h1>
          <p className="mt-1 text-muted-foreground">Consulta y audita la asistencia registrada por los profesores.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Profesor</Label>
            <TeacherCombobox teachers={teachers} value={selectedTeacherId} onChange={setSelectedTeacherId} allowAll />
          </div>
          <div className="w-full space-y-2 sm:w-48">
            <Label>Estado</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="open">Abiertas</SelectItem>
                <SelectItem value="closed">Cerradas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Sesiones de asistencia</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${filteredSessions.length} sesión${filteredSessions.length === 1 ? "" : "es"}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">No hay sesiones de asistencia</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {sessions.length === 0
                  ? "Los profesores aún no han tomado asistencia."
                  : "Ajusta los filtros para ver otras sesiones."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Fecha</TableHead>
                  <TableHead>Profesor</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Materia</TableHead>
                  <TableHead>Resumen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => {
                  const counts = countByStatus(session)
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="pl-6 text-sm text-foreground">
                        {new Date(session.date).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {session.teacher.user.firstName} {session.teacher.user.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{session.group.name}</TableCell>
                      <TableCell className="text-sm text-foreground">{session.schedule?.subject.name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {counts.ABSENT > 0 && <span className="text-red-600">{counts.ABSENT} ausente{counts.ABSENT === 1 ? "" : "s"}</span>}
                          {counts.LATE > 0 && <span>{counts.ABSENT > 0 ? "· " : ""}{counts.LATE} tarde</span>}
                          {counts.ABSENT === 0 && counts.LATE === 0 && (
                            <span>{ATTENDANCE_STATUS_LABELS.PRESENT}: {counts.PRESENT}/{session.records.length}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.isOpen ? "outline" : "secondary"} className="gap-1.5">
                          {session.isOpen ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {session.isOpen ? "Abierta" : "Cerrada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openSessionDialog(session)}>
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AttendanceSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={activeSession}
        onUpdated={handleUpdated}
      />
    </div>
  )
}
