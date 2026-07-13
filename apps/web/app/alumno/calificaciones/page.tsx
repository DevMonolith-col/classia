"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ClipboardList } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Mark } from "@/components/profesor/marks-types"

export default function AlumnoCalificacionesPage() {
  const [marks, setMarks] = useState<Mark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/marks", { silent: true })
      if (!res.ok) throw new Error("No se pudieron cargar tus calificaciones.")
      setMarks((await res.json()) as Mark[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const bySubject = marks.reduce<Record<string, Mark[]>>((acc, mark) => {
    const key = mark.subject.name
    acc[key] = acc[key] ? [...acc[key], mark] : [mark]
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Calificaciones</h1>
        <p className="mt-1 text-muted-foreground">Tus notas por materia.</p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : marks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Aún no tienes calificaciones registradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(bySubject).map(([subjectName, subjectMarks]) => (
            <Card key={subjectName}>
              <CardHeader className="border-b border-border">
                <CardTitle>{subjectName}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {subjectMarks.map((mark) => (
                    <div key={mark.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{mark.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {mark.homework && <Badge variant="outline">{mark.homework.weight}% de la nota</Badge>}
                          <span>{new Date(mark.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                      <span className="shrink-0 text-lg font-semibold text-foreground">
                        {mark.value}/{mark.maxValue}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
