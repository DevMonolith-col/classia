"use client"

import { useState } from "react"
import {
  BarChart3,
  Download,
  FileText,
  Users,
  GraduationCap,
  TrendingUp,
  Calendar,
  Filter,
  ChevronDown,
  Eye,
  Printer,
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ReportType = "asistencia" | "calificaciones" | "estudiantes" | "profesores" | "cursos" | "financiero"

const reportTypes = [
  {
    id: "asistencia" as ReportType,
    name: "Reporte de Asistencia",
    description: "Análisis de asistencia por curso, estudiante y período",
    icon: ClipboardCheck,
    color: "bg-emerald-500",
  },
  {
    id: "calificaciones" as ReportType,
    name: "Reporte de Calificaciones",
    description: "Rendimiento académico y promedios por materia",
    icon: TrendingUp,
    color: "bg-blue-500",
  },
  {
    id: "estudiantes" as ReportType,
    name: "Reporte de Estudiantes",
    description: "Información demográfica y estadísticas de matrícula",
    icon: GraduationCap,
    color: "bg-purple-500",
  },
  {
    id: "profesores" as ReportType,
    name: "Reporte de Profesores",
    description: "Carga horaria, evaluaciones y desempeño docente",
    icon: Users,
    color: "bg-orange-500",
  },
  {
    id: "cursos" as ReportType,
    name: "Reporte de Cursos",
    description: "Estado de cursos, capacidad y distribución",
    icon: BookOpen,
    color: "bg-cyan-500",
  },
  {
    id: "financiero" as ReportType,
    name: "Reporte Financiero",
    description: "Pagos, morosidad y estado de cuenta",
    icon: FileText,
    color: "bg-amber-500",
  },
]

const recentReports = [
  {
    id: 1,
    name: "Asistencia Marzo 2024",
    type: "asistencia",
    date: "15 Mar 2024",
    status: "completado",
    size: "2.4 MB",
  },
  {
    id: 2,
    name: "Calificaciones 1er Bimestre",
    type: "calificaciones",
    date: "10 Mar 2024",
    status: "completado",
    size: "5.1 MB",
  },
  {
    id: 3,
    name: "Estudiantes Nuevos 2024",
    type: "estudiantes",
    date: "05 Mar 2024",
    status: "completado",
    size: "1.8 MB",
  },
  {
    id: 4,
    name: "Carga Docente Semestre 1",
    type: "profesores",
    date: "01 Mar 2024",
    status: "procesando",
    size: "-",
  },
]

const scheduledReports = [
  {
    id: 1,
    name: "Asistencia Semanal",
    frequency: "Cada Lunes",
    nextRun: "18 Mar 2024",
    recipients: 5,
  },
  {
    id: 2,
    name: "Resumen Mensual",
    frequency: "1ro de cada mes",
    nextRun: "01 Abr 2024",
    recipients: 12,
  },
]

export default function AdminReportesPage() {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Reportes
          </h1>
          <p className="mt-1 text-muted-foreground">
            Genera y descarga reportes detallados de tu institución
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Programar Reporte
          </Button>
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            Nuevo Reporte
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <FileText className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">156</p>
                <p className="text-sm text-muted-foreground">Reportes Generados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <Clock className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">8</p>
                <p className="text-sm text-muted-foreground">Programados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <Download className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">342</p>
                <p className="text-sm text-muted-foreground">Descargas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <Mail className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">89</p>
                <p className="text-sm text-muted-foreground">Enviados por Email</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Types Grid */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Tipos de Reporte</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((report) => (
            <Card
              key={report.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedType === report.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedType(report.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${report.color}`}>
                    <report.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{report.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Report Configuration Panel */}
      {selectedType && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Configurar Reporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Fecha Inicio
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Fecha Fin
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Curso
                </label>
                <button className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Todos los cursos</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Formato
                </label>
                <button className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <span className="text-muted-foreground">PDF</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Generar Reporte
              </Button>
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" />
                Vista Previa
              </Button>
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Enviar por Email
              </Button>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                Programar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Reports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reportes Recientes</CardTitle>
            <Button variant="ghost" size="sm">Ver todos</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-4 rounded-lg border border-border p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <FileText className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground">{report.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.date} • {report.size}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === "completado" ? (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-amber-600">
                        <Clock className="h-4 w-4" />
                      </span>
                    )}
                    <Button variant="ghost" size="icon" disabled={report.status !== "completado"}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={report.status !== "completado"}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Reports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reportes Programados</CardTitle>
            <Button variant="ghost" size="sm">Administrar</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduledReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-4 rounded-lg border border-border p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Calendar className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{report.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.frequency} • Próximo: {report.nextRun}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {report.recipients}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">
                Configura reportes automáticos
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Programa reportes para recibirlos periódicamente
              </p>
              <Button variant="outline" size="sm" className="mt-4">
                Crear Programación
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
