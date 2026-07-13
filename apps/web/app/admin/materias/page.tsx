"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BookOpen, Pencil, Plus, RefreshCw, Search } from "lucide-react"
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
import { SubjectFormDialog } from "@/components/admin/subject-form-dialog"
import type { Subject } from "@/components/admin/academic-types"

export default function AdminMateriasPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)

  const loadSubjects = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/subjects", { silent: true })
      if (!res.ok) {
        throw new Error(res.status === 403 ? "No tienes permiso para ver las materias." : "No se pudo cargar el listado de materias.")
      }
      const data = (await res.json()) as Subject[]
      setSubjects(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setSubjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  const filteredSubjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return subjects
    return subjects.filter((subject) =>
      [subject.name, subject.code].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [query, subjects])

  function openCreateDialog() {
    setEditingSubject(null)
    setDialogOpen(true)
  }

  function openEditDialog(subject: Subject) {
    setEditingSubject(subject)
    setDialogOpen(true)
  }

  function handleSaved(saved: Subject) {
    setSubjects((current) => {
      const exists = current.some((subject) => subject.id === saved.id)
      if (exists) return current.map((subject) => (subject.id === saved.id ? saved : subject))
      return [...current, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Materias</h1>
          <p className="mt-1 text-muted-foreground">Administra las materias que se dictan en el colegio.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadSubjects} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Nueva materia
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
              <CardTitle>Materias registradas</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Cargando..." : `${subjects.length} materia${subjects.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar materia o código"
                className="h-9 w-full pl-9 sm:w-64"
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
          ) : filteredSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                {subjects.length === 0 ? "Aún no hay materias registradas" : "No hay materias para este filtro"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {subjects.length === 0 ? "Crea la primera materia para empezar." : "Ajusta la búsqueda o crea una nueva materia."}
              </p>
              {subjects.length === 0 && (
                <Button className="mt-4 gap-2" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Nueva materia
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Nombre</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Horarios asignados</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <BookOpen className="h-4 w-4 text-foreground" />
                        </div>
                        <p className="font-medium text-foreground">{subject.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{subject.code ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{subject._count?.schedules ?? 0}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(subject)}>
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

      <SubjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subject={editingSubject}
        onSaved={handleSaved}
      />
    </div>
  )
}
