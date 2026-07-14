"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, GraduationCap, Pencil, Plus, RefreshCw, Search } from "lucide-react"
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
import { StudentFormDialog } from "@/components/admin/student-form-dialog"
import type { Group } from "@/components/admin/academic-types"
import type { Guardian, Student } from "@/components/admin/student-types"

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

function EstudiantesPageContent() {
  const searchParams = useSearchParams()
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [studentsRes, groupsRes, guardiansRes] = await Promise.all([
        apiFetch("/students", { silent: true }),
        apiFetch("/groups", { silent: true }),
        apiFetch("/guardians", { silent: true }),
      ])

      if (!studentsRes.ok) {
        throw new Error(
          studentsRes.status === 403 ? "No tienes permiso para ver los estudiantes." : "No se pudo cargar el listado de estudiantes.",
        )
      }

      const studentsData = (await studentsRes.json()) as Student[]
      setStudents(Array.isArray(studentsData) ? studentsData : [])
      setGroups(groupsRes.ok ? ((await groupsRes.json()) as Group[]) : [])
      setGuardians(guardiansRes.ok ? ((await guardiansRes.json()) as Guardian[]) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students
    return students.filter((student) =>
      [student.firstName, student.lastName, student.documentId, student.group?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [query, students])

  function openCreateDialog() {
    setEditingStudent(null)
    setDialogOpen(true)
  }

  useEffect(() => {
    if (searchParams.get("new") === "1") openCreateDialog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function openEditDialog(student: Student) {
    setEditingStudent(student)
    setDialogOpen(true)
  }

  function handleSaved(saved: Student) {
    setStudents((current) => {
      const exists = current.some((student) => student.id === saved.id)
      if (exists) return current.map((student) => (student.id === saved.id ? saved : student))
      return [...current, saved].sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Estudiantes</h1>
          <p className="mt-1 text-muted-foreground">Gestiona la información de todos los estudiantes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Agregar Estudiante
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader className="gap-4 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Estudiantes registrados</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Cargando..." : `${students.length} estudiante${students.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, documento o curso"
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
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                {students.length === 0 ? "Aún no hay estudiantes registrados" : "No hay estudiantes para este filtro"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {students.length === 0 ? "Agrega el primer estudiante para empezar." : "Ajusta la búsqueda o agrega un nuevo estudiante."}
              </p>
              {students.length === 0 && (
                <Button className="mt-4 gap-2" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Agregar Estudiante
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Estudiante</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Acudientes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {initials(student.firstName, student.lastName)}
                        </div>
                        <p className="font-medium text-foreground">
                          {student.firstName} {student.lastName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{student.group?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{student.documentId ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.guardians.length > 0
                        ? student.guardians.map((link) => `${link.guardian.user.firstName} ${link.guardian.user.lastName}`).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          student.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {student.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(student)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StudentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        student={editingStudent}
        groups={groups}
        guardians={guardians}
        onSaved={handleSaved}
      />
    </div>
  )
}

export default function EstudiantesPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 lg:p-8"><div className="h-64 animate-pulse rounded-lg bg-secondary" /></div>}>
      <EstudiantesPageContent />
    </Suspense>
  )
}
