"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AuditLog, AuditLogsResponse } from "@/components/superadmin/audit-types"
import { ROLE_LABELS, type User } from "@/components/superadmin/user-types"
import { humanizeAuditAction } from "@/components/shared/audit-labels"

const PAGE_SIZE = 20

export default function AdminActividadPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [hasNextPage, setHasNextPage] = useState(false)
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const fetchPage = useCallback(async (index: number, history: (string | undefined)[]) => {
    setLoading(true)
    setError("")
    try {
      const cursor = history[index]
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (cursor) qs.set("cursor", cursor)

      const res = await apiFetch(`/audit/logs?${qs.toString()}`, { silent: true })
      if (!res.ok) {
        throw new Error(
          res.status === 403 ? "No tienes permiso para ver la actividad." : "No se pudo cargar la actividad.",
        )
      }

      const data = (await res.json()) as AuditLogsResponse
      setLogs(data.items)
      setHasNextPage(data.pageInfo.hasNextPage)
      setPageIndex(index)
      if (data.pageInfo.nextCursor && history.length === index + 1) {
        setCursorHistory([...history, data.pageInfo.nextCursor])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    const res = await apiFetch("/users", { silent: true })
    setUsers(res.ok ? (((await res.json()) as User[]) ?? []) : [])
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    fetchPage(0, [undefined])
  }, [fetchPage])

  function refresh() {
    const history = [undefined]
    setCursorHistory(history)
    fetchPage(0, history)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Actividad Reciente</h1>
          <p className="mt-1 text-muted-foreground">
            Historial de acciones registradas en tu institución.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando actividad...</p>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <ClipboardList className="h-8 w-8" />
              <p>Todavía no hay actividad registrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const user = log.userId ? userById.get(log.userId) : undefined
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("es-CO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user ? `${user.firstName} ${user.lastName}` : "—"}
                        {log.actorRole && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({ROLE_LABELS[log.actorRole as keyof typeof ROLE_LABELS] ?? log.actorRole})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-foreground">{humanizeAuditAction(log.action)}</p>
                        <code className="text-xs text-muted-foreground">{log.action}</code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.entityType ?? "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex === 0 || loading}
              onClick={() => fetchPage(pageIndex - 1, cursorHistory)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage || loading}
              onClick={() => fetchPage(pageIndex + 1, cursorHistory)}
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
