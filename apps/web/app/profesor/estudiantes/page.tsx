"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, GraduationCap, Search } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
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
import type { Schedule } from "@/components/admin/academic-types"
import type { Student } from "@/components/admin/student-types"

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

export default function ProfesorEstudiantesPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const bootstrapRes = await apiFetch("/app/bootstrap", { silent: true })
      if (!bootstrapRes.ok) throw new Error("No se pudo cargar tu perfil de profesor.")
      const bootstrap = (await bootstrapRes.json()) as {
        summary?: { kind?: string; teacher?: { id?: string } }
      }
      const teacherId = bootstrap.summary?.teacher?.id
      if (!bootstrap.summary || bootstrap.summary.kind !== "teacher" || !teacherId) {
        throw new Error("Esta cuenta no tiene un perfil de profesor asociado.")
      }

      const schedulesRes = await apiFetch(`/schedules?teacherId=${teacherId}`, { silent: true })
      if (!schedulesRes.ok) throw new Error("No se pudieron cargar tus grupos.")
      const schedules = (await schedulesRes.json()) as Schedule[]
      const groupIds = [...new Set(schedules.map((s) => s.group.id))]

      const studentsByGroup = await Promise.all(
        groupIds.map(async (groupId) => {
          const res = await apiFetch(`/students?groupId=${groupId}`, { silent: true })
          return res.ok ? ((await res.json()) as Student[]) : []
        }),
      )
      const byId = new Map(studentsByGroup.flat().map((s) => [s.id, s]))
      setStudents(
        [...byId.values()].sort(
          (a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students
    return students.filter((s) =>
      [s.firstName, s.lastName, s.documentId, s.group?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(normalized)),
    )
  }, [query, students])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Mis Estudiantes</h1>
          <p className="mt-1 text-muted-foreground">
            Estudiantes de los grupos que dictas. Solo lectura — la edición se hace desde Administración.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, documento o curso..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estudiantes ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando estudiantes...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <GraduationCap className="h-8 w-8" />
              <p>No se encontraron estudiantes.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Curso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                          {initials(student.firstName, student.lastName)}
                        </div>
                        <span className="font-medium text-foreground">
                          {student.firstName} {student.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.documentId ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.group ? `${student.group.grade} ${student.group.section}` : "Sin grupo"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
