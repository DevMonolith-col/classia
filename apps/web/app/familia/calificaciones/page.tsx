import {
  TrendingUp,
  TrendingDown,
  Download,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const subjects = [
  {
    id: "1",
    name: "Matemáticas",
    teacher: "Prof. Juan López",
    grades: [
      { period: "Parcial 1", grade: 95, weight: 30 },
      { period: "Parcial 2", grade: 88, weight: 30 },
      { period: "Tareas", grade: 92, weight: 20 },
      { period: "Participación", grade: 90, weight: 20 },
    ],
    average: 91.4,
    trend: "up",
  },
  {
    id: "2",
    name: "Español",
    teacher: "Prof. Ana Martínez",
    grades: [
      { period: "Parcial 1", grade: 88, weight: 30 },
      { period: "Parcial 2", grade: 90, weight: 30 },
      { period: "Tareas", grade: 85, weight: 20 },
      { period: "Participación", grade: 92, weight: 20 },
    ],
    average: 88.8,
    trend: "up",
  },
  {
    id: "3",
    name: "Ciencias Naturales",
    teacher: "Prof. Carlos Ruiz",
    grades: [
      { period: "Parcial 1", grade: 92, weight: 30 },
      { period: "Parcial 2", grade: 85, weight: 30 },
      { period: "Tareas", grade: 90, weight: 20 },
      { period: "Participación", grade: 88, weight: 20 },
    ],
    average: 88.7,
    trend: "down",
  },
  {
    id: "4",
    name: "Historia",
    teacher: "Prof. María Gómez",
    grades: [
      { period: "Parcial 1", grade: 85, weight: 30 },
      { period: "Parcial 2", grade: 88, weight: 30 },
      { period: "Tareas", grade: 90, weight: 20 },
      { period: "Participación", grade: 85, weight: 20 },
    ],
    average: 87.0,
    trend: "up",
  },
  {
    id: "5",
    name: "Inglés",
    teacher: "Prof. Lisa Johnson",
    grades: [
      { period: "Parcial 1", grade: 98, weight: 30 },
      { period: "Parcial 2", grade: 95, weight: 30 },
      { period: "Tareas", grade: 100, weight: 20 },
      { period: "Participación", grade: 95, weight: 20 },
    ],
    average: 97.0,
    trend: "up",
  },
  {
    id: "6",
    name: "Educación Física",
    teacher: "Prof. Roberto Sánchez",
    grades: [
      { period: "Parcial 1", grade: 90, weight: 30 },
      { period: "Parcial 2", grade: 92, weight: 30 },
      { period: "Tareas", grade: 95, weight: 20 },
      { period: "Participación", grade: 98, weight: 20 },
    ],
    average: 93.2,
    trend: "up",
  },
]

const generalAverage = (
  subjects.reduce((acc, subject) => acc + subject.average, 0) / subjects.length
).toFixed(1)

export default function CalificacionesFamiliaPage() {
  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-success"
    if (grade >= 70) return "text-foreground"
    return "text-destructive"
  }

  const getGradeBg = (grade: number) => {
    if (grade >= 90) return "bg-success/10"
    if (grade >= 70) return "bg-secondary"
    return "bg-destructive/10"
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Calificaciones
          </h1>
          <p className="mt-1 text-muted-foreground">
            María García López • 5to Grado A • Ciclo Escolar 2024
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Descargar Boleta
        </Button>
      </div>

      {/* General Average Card */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Promedio General
              </p>
              <p className={`text-4xl font-bold ${getGradeColor(Number(generalAverage))}`}>
                {generalAverage}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:justify-end">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">5</p>
                <p className="text-xs text-muted-foreground">Excelente</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">1</p>
                <p className="text-xs text-muted-foreground">Bueno</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">0</p>
                <p className="text-xs text-muted-foreground">Por mejorar</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subjects Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <Card key={subject.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{subject.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{subject.teacher}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-2xl font-bold ${getGradeColor(subject.average)}`}
                  >
                    {subject.average.toFixed(1)}
                  </span>
                  {subject.trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {subject.grades.map((grade) => (
                  <div
                    key={grade.period}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {grade.period}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({grade.weight}%)
                      </span>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-sm font-medium ${getGradeBg(
                        grade.grade
                      )} ${getGradeColor(grade.grade)}`}
                    >
                      {grade.grade}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <p className="text-sm font-medium text-foreground">Escala de calificaciones:</p>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">90-100 Excelente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-foreground" />
              <span className="text-sm text-muted-foreground">70-89 Bueno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <span className="text-sm text-muted-foreground">&lt;70 Por mejorar</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
