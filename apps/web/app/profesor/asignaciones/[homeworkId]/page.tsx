"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { HomeworkEditor } from "@/components/profesor/homework-editor"
import type { Homework } from "@/components/profesor/homework-types"

export default function EditarAsignacionPage() {
  const params = useParams<{ homeworkId: string }>()
  const [homework, setHomework] = useState<Homework | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/homework/${params.homeworkId}`, { silent: true })
      if (!res.ok) throw new Error("No se pudo cargar la asignación.")
      setHomework((await res.json()) as Homework)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [params.homeworkId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      </div>
    )
  }

  if (error || !homework) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error || "Asignación no encontrada."}</p>
        </div>
      </div>
    )
  }

  return <HomeworkEditor mode="edit" homework={homework} />
}
