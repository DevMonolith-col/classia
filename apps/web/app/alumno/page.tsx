"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ClipboardList, FileText } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import type { Homework } from "@/components/profesor/homework-types"

type StudentSummary = {
  id: string
  firstName: string
  lastName: string
  documentId?: string | null
  group?: { id: string; name: string; grade: string; section: string } | null
} | null

export default function AlumnoPanelPage() {
  const [student, setStudent] = useState<StudentSummary>(null)
  const [pending, setPending] = useState<Homework[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const bootstrapRes = await apiFetch("/app/bootstrap", { silent: true })
      if (!bootstrapRes.ok) throw new Error("No se pudo cargar tu perfil.")
      const bootstrap = (await bootstrapRes.json()) as { summary?: { kind?: string; student?: StudentSummary } }
      if (!bootstrap.summary || bootstrap.summary.kind !== "student" || !bootstrap.summary.student) {
        throw new Error("Esta cuenta no tiene un perfil de estudiante asociado.")
      }
      setStudent(bootstrap.summary.student)

      const homeworkRes = await apiFetch("/homework", { silent: true })
      if (homeworkRes.ok) {
        const data = (await homeworkRes.json()) as Homework[]
        const now = Date.now()
        setPending(
          data
            .filter((h) => h.status === "ACTIVE" && new Date(h.dueDate).getTime() >= now)
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .slice(0, 5),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {student ? `Hola, ${student.firstName}` : "Mi Panel"}
        </h1>
        {student?.group && <p className="mt-1 text-muted-foreground">{student.group.name}</p>}
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold text-foreground">Próximas asignaciones</h2>
            <Link href="/alumno/asignaciones" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No tienes asignaciones pendientes.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pending.map((homework) => (
                <Link
                  key={homework.id}
                  href="/alumno/asignaciones"
                  className="flex items-center gap-3 p-4 hover:bg-secondary/50"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{homework.title}</p>
                    <p className="text-xs text-muted-foreground">{homework.subject.name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(homework.dueDate).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
