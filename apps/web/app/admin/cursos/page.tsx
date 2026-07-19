"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search, Users } from "lucide-react"
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
import { GroupFormDialog } from "@/components/admin/group-form-dialog"
import type { Group } from "@/components/admin/academic-types"

const PAGE_SIZE = 10

function AdminCursosPageContent() {
  const searchParams = useSearchParams()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [page, setPage] = useState(1)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/groups", { silent: true })
      if (!res.ok) {
        throw new Error(res.status === 403 ? "No tienes permiso para ver los cursos." : "No se pudo cargar el listado de cursos.")
      }
      const data = (await res.json()) as Group[]
      setGroups(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return groups
    return groups.filter((group) =>
      [group.name, group.grade, group.section].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [query, groups])

  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query])

  const stats = useMemo(
    () => ({
      total: groups.length,
      estudiantes: groups.reduce((acc, g) => acc + (g._count?.students ?? 0), 0),
      horarios: groups.reduce((acc, g) => acc + (g._count?.schedules ?? 0), 0),
    }),
    [groups],
  )

  function openCreateDialog() {
    setEditingGroup(null)
    setDialogOpen(true)
  }

  useEffect(() => {
    if (searchParams.get("new") === "1") openCreateDialog()
  }, [searchParams])

  function openEditDialog(group: Group) {
    setEditingGroup(group)
    setDialogOpen(true)
  }

  function handleSaved(saved: Group) {
    setGroups((current) => {
      const exists = current.some((group) => group.id === saved.id)
      if (exists) return current.map((group) => (group.id === saved.id ? { ...group, ...saved } : group))
      return [...current, saved].sort((a, b) => a.grade.localeCompare(b.grade) || a.section.localeCompare(b.section))
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Cursos</h1>
          <p className="mt-1 text-muted-foreground">Administra los cursos, grados y secciones del colegio.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadGroups} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Nuevo curso
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
                <BookOpen className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Cursos</p>
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
                <p className="text-2xl font-bold text-foreground">{stats.estudiantes}</p>
                <p className="text-sm text-muted-foreground">Estudiantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <BookOpen className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.horarios}</p>
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
              <CardTitle>Cursos registrados</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Cargando..." : `${groups.length} curso${groups.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, grado o sección"
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
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                {groups.length === 0 ? "Aún no hay cursos registrados" : "No hay cursos para este filtro"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {groups.length === 0 ? "Crea el primer curso para empezar." : "Ajusta la búsqueda o crea un nuevo curso."}
              </p>
              {groups.length === 0 && (
                <Button className="mt-4 gap-2" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Nuevo curso
                </Button>
              )}
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Curso</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Estudiantes</TableHead>
                  <TableHead>Horarios</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <BookOpen className="h-4 w-4 text-foreground" />
                        </div>
                        <p className="font-medium text-foreground">{group.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{group.grade}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{group.section}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{group._count?.students ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{group._count?.schedules ?? 0}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditDialog(group)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Página {currentPage} de {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={currentPage >= pageCount}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <GroupFormDialog open={dialogOpen} onOpenChange={setDialogOpen} group={editingGroup} onSaved={handleSaved} />
    </div>
  )
}

export default function AdminCursosPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 lg:p-8"><div className="h-64 animate-pulse rounded-lg bg-secondary" /></div>}>
      <AdminCursosPageContent />
    </Suspense>
  )
}
