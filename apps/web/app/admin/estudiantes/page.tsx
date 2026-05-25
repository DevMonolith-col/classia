"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const students = [
  {
    id: "1",
    name: "María García López",
    email: "maria.garcia@estudiante.edu",
    grade: "5to Grado A",
    status: "Activo",
    phone: "+52 555 123 4567",
    avatar: "MG",
  },
  {
    id: "2",
    name: "Carlos Rodríguez Pérez",
    email: "carlos.rodriguez@estudiante.edu",
    grade: "5to Grado A",
    status: "Activo",
    phone: "+52 555 234 5678",
    avatar: "CR",
  },
  {
    id: "3",
    name: "Ana Martínez Sánchez",
    email: "ana.martinez@estudiante.edu",
    grade: "6to Grado B",
    status: "Activo",
    phone: "+52 555 345 6789",
    avatar: "AM",
  },
  {
    id: "4",
    name: "Diego López Hernández",
    email: "diego.lopez@estudiante.edu",
    grade: "4to Grado A",
    status: "Inactivo",
    phone: "+52 555 456 7890",
    avatar: "DL",
  },
  {
    id: "5",
    name: "Sofía Ramírez Torres",
    email: "sofia.ramirez@estudiante.edu",
    grade: "6to Grado A",
    status: "Activo",
    phone: "+52 555 567 8901",
    avatar: "SR",
  },
  {
    id: "6",
    name: "Javier Moreno Díaz",
    email: "javier.moreno@estudiante.edu",
    grade: "3er Grado B",
    status: "Activo",
    phone: "+52 555 678 9012",
    avatar: "JM",
  },
]

export default function EstudiantesPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.grade.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Estudiantes
          </h1>
          <p className="mt-1 text-muted-foreground">
            Gestiona la información de todos los estudiantes
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/admin/estudiantes/nuevo">
            <Plus className="h-4 w-4" />
            Agregar Estudiante
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o grado..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Students Table - Desktop */}
      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Estudiante
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Grado
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Contacto
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                    Acciones
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {student.avatar}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{student.grade}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <a
                          href={`mailto:${student.email}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                        <a
                          href={`tel:${student.phone}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          student.status === "Activo"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Students Cards - Mobile & Tablet */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {filteredStudents.map((student) => (
          <Card key={student.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {student.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{student.name}</p>
                    <p className="text-sm text-muted-foreground">{student.grade}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    student.status === "Activo"
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {student.status}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
                <a
                  href={`mailto:${student.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </a>
                <a
                  href={`tel:${student.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  Llamar
                </a>
                <Button variant="ghost" size="sm" className="ml-auto">
                  Ver Perfil
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredStudents.length} de {students.length} estudiantes
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            1
          </Button>
          <Button variant="ghost" size="sm">
            2
          </Button>
          <Button variant="ghost" size="sm">
            3
          </Button>
          <Button variant="outline" size="icon">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
