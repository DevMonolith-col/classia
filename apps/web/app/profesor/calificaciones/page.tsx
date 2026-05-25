"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Search,
  Download,
  Save,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const classes = [
  { id: "1", name: "5to Grado A - Matemáticas" },
  { id: "2", name: "6to Grado B - Matemáticas" },
  { id: "3", name: "6to Grado A - Álgebra" },
  { id: "4", name: "4to Grado A - Matemáticas" },
]

const evaluations = [
  { id: "1", name: "Parcial 1", weight: 30 },
  { id: "2", name: "Parcial 2", weight: 30 },
  { id: "3", name: "Tareas", weight: 20 },
  { id: "4", name: "Participación", weight: 20 },
]

const students = [
  {
    id: "1",
    name: "María García López",
    grades: { "1": 95, "2": 88, "3": 92, "4": 90 },
    average: 91.4,
  },
  {
    id: "2",
    name: "Carlos Rodríguez Pérez",
    grades: { "1": 78, "2": 82, "3": 85, "4": 80 },
    average: 80.6,
  },
  {
    id: "3",
    name: "Ana Martínez Sánchez",
    grades: { "1": 92, "2": 95, "3": 90, "4": 95 },
    average: 93.1,
  },
  {
    id: "4",
    name: "Diego López Hernández",
    grades: { "1": 65, "2": 70, "3": 72, "4": 68 },
    average: 68.4,
  },
  {
    id: "5",
    name: "Sofía Ramírez Torres",
    grades: { "1": 88, "2": 85, "3": 90, "4": 92 },
    average: 88.2,
  },
  {
    id: "6",
    name: "Javier Moreno Díaz",
    grades: { "1": 72, "2": 75, "3": 80, "4": 78 },
    average: 75.8,
  },
]

export default function CalificacionesPage() {
  const [selectedClass, setSelectedClass] = useState(classes[0].id)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-success"
    if (grade >= 70) return "text-foreground"
    return "text-destructive"
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
            Registra y gestiona las calificaciones de tus estudiantes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Class Selector */}
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-10 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar estudiante..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table - Desktop */}
      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Estudiante
                  </th>
                  {evaluations.map((evaluation) => (
                    <th
                      key={evaluation.id}
                      className="px-4 py-4 text-center text-sm font-semibold text-foreground"
                    >
                      <div>{evaluation.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {evaluation.weight}%
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                    Promedio
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {student.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <span className="font-medium text-foreground">{student.name}</span>
                      </div>
                    </td>
                    {evaluations.map((evaluation) => (
                      <td key={evaluation.id} className="px-4 py-4 text-center">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          defaultValue={student.grades[evaluation.id as keyof typeof student.grades]}
                          className={`w-16 text-center ${getGradeColor(
                            student.grades[evaluation.id as keyof typeof student.grades]
                          )}`}
                        />
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`text-lg font-bold ${getGradeColor(student.average)}`}
                      >
                        {student.average.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Grades Cards - Mobile & Tablet */}
      <div className="grid gap-4 lg:hidden">
        {filteredStudents.map((student) => (
          <Card key={student.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {student.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <span className="font-medium text-foreground">{student.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Promedio</p>
                  <p className={`text-xl font-bold ${getGradeColor(student.average)}`}>
                    {student.average.toFixed(1)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {evaluations.map((evaluation) => (
                  <div key={evaluation.id}>
                    <label className="text-xs text-muted-foreground">
                      {evaluation.name}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={student.grades[evaluation.id as keyof typeof student.grades]}
                      className={`mt-1 text-center ${getGradeColor(
                        student.grades[evaluation.id as keyof typeof student.grades]
                      )}`}
                    />
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
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Excelente (90-100)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-foreground" />
              <span className="text-sm text-muted-foreground">Aprobado (70-89)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <span className="text-sm text-muted-foreground">Reprobado (&lt;70)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
