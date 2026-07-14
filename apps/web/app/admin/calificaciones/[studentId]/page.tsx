"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import { StudentGradesTable } from "@/components/shared/student-grades-table"
import type { Mark } from "@/components/profesor/marks-types"

export default function AdminStudentGradesPage() {
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const [marks, setMarks] = useState<Mark[]>([])
  const [studentName, setStudentName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [studentRes, marksRes] = await Promise.all([
        apiFetch(`/students/${studentId}`, { silent: true }),
        apiFetch(`/marks?studentId=${studentId}`, { silent: true })
      ])

      if (!studentRes.ok) throw new Error("No se pudo cargar la información del estudiante.")
      const studentData = await studentRes.json()
      setStudentName(`${studentData.firstName} ${studentData.lastName}`)

      if (marksRes.ok) {
        setMarks(await marksRes.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los datos.")
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    if (studentId) {
      loadData()
    }
  }, [studentId, loadData])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              Boletín de Calificaciones
            </h1>
            <p className="mt-1 text-muted-foreground">
              {loading ? "Cargando..." : studentName}
            </p>
          </div>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Descargar Boleta
        </Button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-secondary" />
          <div className="h-32 animate-pulse rounded-lg bg-secondary" />
        </div>
      ) : (
        <StudentGradesTable marks={marks} studentName={studentName} />
      )}
    </div>
  )
}
