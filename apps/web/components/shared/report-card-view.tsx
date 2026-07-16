"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Line = {
  subjectId: string
  subjectName: string
  final: number | null
  label: string | null
  passing: boolean | null
}

type Report = {
  scaleName: string
  passingValue: number
  overallAverage: number | null
  lines: Line[]
}

// Consume el motor inmutable del backend (report-cards): la definitiva oficial,
// no el cálculo local de la grilla de edición. Sin periodId = boletín del año.
export function ReportCardView({ studentId, periodId }: { studentId: string; periodId?: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const qs = new URLSearchParams({ studentId })
        if (periodId) qs.set("periodId", periodId)
        const res = await apiFetch(`/report-cards/preview?${qs.toString()}`, { silent: true })
        if (!res.ok) throw new Error("No se pudo calcular el boletín.")
        const data = (await res.json()) as Report
        if (!cancelled) setReport(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [studentId, periodId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error || !report) {
    return <p className="py-8 text-center text-sm text-destructive">{error || "Sin datos."}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{report.scaleName}</p>
          <p className="text-sm font-medium text-foreground">Definitiva del periodo</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">
            {report.overallAverage !== null ? report.overallAverage.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Promedio general</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-medium">Materia</th>
              <th className="px-4 py-2 text-center font-medium">Definitiva</th>
              <th className="px-4 py-2 font-medium">Desempeño</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.subjectId} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{line.subjectName}</td>
                <td className="px-4 py-3 text-center">
                  {line.final !== null ? (
                    <span
                      className={`font-semibold ${
                        line.passing ? "text-foreground" : "text-destructive"
                      }`}
                    >
                      {line.final.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin notas</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {line.label ? (
                    <Badge variant={line.passing ? "outline" : "destructive"}>{line.label}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ReportCardDialog({
  studentId,
  studentName,
  periodId,
}: {
  studentId: string
  studentName: string
  periodId?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <FileText className="h-3.5 w-3.5" />
          Boletín
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Boletín — {studentName}</DialogTitle>
        </DialogHeader>
        {open && <ReportCardView studentId={studentId} periodId={periodId} />}
      </DialogContent>
    </Dialog>
  )
}
