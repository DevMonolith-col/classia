"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Mail, Pencil, Plus, Power, RefreshCw, Search, Users } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TeacherFormDialog } from "@/components/admin/teacher-form-dialog"
import type { Teacher } from "@/components/admin/academic-types"

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  SUSPENDED: "Suspendido",
  PENDING: "Pendiente",
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

export default function AdminProfesoresPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadTeachers = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/teachers", { silent: true })
      if (!res.ok) {
        throw new Error(res.status === 403 ? "No tienes permiso para ver los profesores." : "No se pudo cargar el listado de profesores.")
      }
      const data = (await res.json()) as Teacher[]
      setTeachers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTeachers()
  }, [loadTeachers])

  const filteredTeachers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return teachers
    return teachers.filter((teacher) =>
      [teacher.user.firstName, teacher.user.lastName, teacher.user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [query, teachers])

  const stats = useMemo(
    () => ({
      total: teachers.length,
      activos: teachers.filter((t) => t.user.status === "ACTIVE").length,
      cursos: teachers.reduce((acc, t) => acc + (t._count?.schedules ?? 0), 0),
    }),
    [teachers],
  )

  function openCreateDialog() {
    setEditingTeacher(null)
    setDialogOpen(true)
  }

  function openEditDialog(teacher: Teacher) {
    setEditingTeacher(teacher)
    setDialogOpen(true)
  }

  function handleSaved(saved: Teacher) {
    setTeachers((current) => {
      const exists = current.some((teacher) => teacher.id === saved.id)
      if (exists) return current.map((teacher) => (teacher.id === saved.id ? saved : teacher))
      return [...current, saved].sort((a, b) => a.user.firstName.localeCompare(b.user.firstName))
    })
  }

  async function toggleStatus(teacher: Teacher) {
    const nextStatus = teacher.user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setTogglingId(teacher.id)
    try {
      const res = await apiFetch(`/users/${teacher.user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
        silent: true,
      })
      if (!res.ok) {
        throw new Error("No se pudo actualizar el estado del profesor.")
      }
      setTeachers((current) =>
        current.map((t) => (t.id === teacher.id ? { ...t, user: { ...t.user, status: nextStatus } } : t)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado del profesor.")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Gestión de Profesores</h1>
          <p className="mt-1 text-muted-foreground">Administra el equipo docente de tu institución.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadTeachers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Nuevo Profesor
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <Users className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Profesores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <Power className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.activos}</p>
                <p className="text-sm text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.cursos}</p>
                <p className="text-sm text-muted-foreground">Horarios asignados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Profesores registrados</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Cargando..." : `${teachers.length} profesor${teachers.length === 1 ? "" : "es"}`}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o correo"
                className="h-9 w-full pl-9 sm:w-72"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                {teachers.length === 0 ? "Aún no hay profesores registrados" : "No se encontraron profesores"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {teachers.length === 0 ? "Crea el primer profesor para empezar." : "Ajusta la búsqueda o agrega un nuevo profesor."}
              </p>
              {teachers.length === 0 && (
                <Button className="mt-4 gap-2" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Nuevo Profesor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Profesor</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Horarios</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {initials(teacher.user.firstName, teacher.user.lastName)}
                        </div>
                        <p className="font-medium text-foreground">
                          {teacher.user.firstName} {teacher.user.lastName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${teacher.user.email}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {teacher.user.email}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{teacher._count?.schedules ?? 0}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          teacher.user.status === "ACTIVE" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[teacher.user.status ?? ""] ?? teacher.user.status ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(teacher)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => toggleStatus(teacher)}
                          disabled={togglingId === teacher.id}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {teacher.user.status === "ACTIVE" ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TeacherFormDialog open={dialogOpen} onOpenChange={setDialogOpen} teacher={editingTeacher} onSaved={handleSaved} />
    </div>
  )
}
