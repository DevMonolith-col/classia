"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Mark } from "@/components/profesor/marks-types"
import { computeWeightedFinal } from "@/lib/grading"

interface Props {
  marks: Mark[]
  studentName?: string
  studentDocumentId?: string
}

export function StudentGradesTable({ marks, studentName = "Estudiante", studentDocumentId }: Props) {
  const bySubject = marks.reduce<Record<string, Mark[]>>((acc, mark) => {
    const key = mark.subject.name
    acc[key] = acc[key] ? [...acc[key], mark] : [mark]
    return acc
  }, {})

  if (marks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">Aún no hay calificaciones registradas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(bySubject).map(([subjectName, subjectMarks]) => {
        const sortedMarks = [...subjectMarks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // Fuente única compartida con la grilla del profesor (antes divergían).
        const finalGrade = computeWeightedFinal(
          sortedMarks.map((m) => ({ value: m.value, maxValue: m.maxValue, weight: m.homework?.weight ?? 0 })),
        )
        const totalWeight = sortedMarks.reduce((sum, m) => sum + (m.homework?.weight ?? 0), 0)
        const title = subjectName
        const assignmentsCount = sortedMarks.length

        return (
          <Card key={subjectName}>
            <CardHeader className="border-b border-border">
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {assignmentsCount} tarea{assignmentsCount !== 1 && "s"} · peso total {totalWeight}% 
                {totalWeight !== 100 && (
                  <span className="text-amber-600 ml-1">(debería sumar 100%)</span>
                )}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="sticky left-0 bg-muted/20 px-4 py-3 text-left font-medium text-muted-foreground">
                        Estudiante
                      </th>
                      {sortedMarks.map((mark) => (
                        <th key={mark.id} className="min-w-[140px] px-3 py-3 text-center font-medium text-muted-foreground">
                          <p className="truncate" title={mark.title}>
                            {mark.title}
                          </p>
                          {mark.homework && (
                            <Badge variant="outline" className="mt-1 font-normal bg-background">
                              {mark.homework.weight}%
                            </Badge>
                          )}
                        </th>
                      ))}
                      <th className="min-w-[120px] px-4 py-3 text-center font-medium text-muted-foreground">
                        Nota final
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="sticky left-0 bg-background px-4 py-4 border-r border-border min-w-[200px]">
                        <p className="font-medium text-foreground">{studentName}</p>
                        {studentDocumentId && (
                           <p className="text-xs text-muted-foreground mt-0.5">{studentDocumentId}</p>
                        )}
                      </td>
                      {sortedMarks.map((mark) => (
                        <td key={mark.id} className="px-3 py-4 text-center">
                          <span className="text-sm font-medium text-foreground">
                            {mark.value}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-4 text-center border-l border-border bg-muted/10">
                        <span className="font-semibold text-foreground text-base">
                          {finalGrade.percent !== null ? finalGrade.percent.toFixed(1) : "—"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
