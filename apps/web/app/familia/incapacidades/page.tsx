"use client"

import { useState } from "react"
import {
  FileText,
  Upload,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Eye,
  Download,
  Trash2,
  ChevronRight,
  User,
  Paperclip,
  X,
  Heart,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type IncapacidadStatus = "pendiente" | "aprobada" | "rechazada"

interface Hijo {
  id: string
  name: string
  avatar: string
  grade: string
  section: string
}

interface Incapacidad {
  id: string
  studentId: string
  studentName: string
  startDate: string
  endDate: string
  reason: string
  document: string
  documentType: string
  submittedAt: string
  status: IncapacidadStatus
  notes: string
  reviewedBy: string
  reviewedAt: string
}

const hijos: Hijo[] = [
  { id: "1", name: "Ana García López", avatar: "AG", grade: "5to", section: "A" },
  { id: "2", name: "Carlos García López", avatar: "CG", grade: "3ro", section: "B" },
]

const mockIncapacidades: Incapacidad[] = [
  {
    id: "1",
    studentId: "1",
    studentName: "Ana García López",
    startDate: "2024-02-12",
    endDate: "2024-02-14",
    reason: "Gripe con fiebre alta",
    document: "certificado_medico.pdf",
    documentType: "PDF",
    submittedAt: "2024-02-11 09:30",
    status: "aprobada",
    notes: "Aprobada - Certificado médico válido",
    reviewedBy: "Prof. María Rodríguez",
    reviewedAt: "2024-02-11 14:22",
  },
  {
    id: "2",
    studentId: "1",
    studentName: "Ana García López",
    startDate: "2024-01-22",
    endDate: "2024-01-22",
    reason: "Cita con especialista",
    document: "cita_medica.jpg",
    documentType: "Imagen",
    submittedAt: "2024-01-20 16:45",
    status: "aprobada",
    notes: "Aprobada",
    reviewedBy: "Prof. Juan Pérez",
    reviewedAt: "2024-01-21 08:15",
  },
  {
    id: "3",
    studentId: "2",
    studentName: "Carlos García López",
    startDate: "2024-02-19",
    endDate: "2024-02-21",
    reason: "Operación dental programada",
    document: "orden_medica.pdf",
    documentType: "PDF",
    submittedAt: "2024-02-15 10:00",
    status: "pendiente",
    notes: "",
    reviewedBy: "",
    reviewedAt: "",
  },
  {
    id: "4",
    studentId: "2",
    studentName: "Carlos García López",
    startDate: "2024-01-15",
    endDate: "2024-01-15",
    reason: "Malestar estomacal",
    document: "",
    documentType: "",
    submittedAt: "2024-01-15 07:30",
    status: "rechazada",
    notes: "Rechazada - Se requiere certificado médico para justificar ausencia",
    reviewedBy: "Prof. Laura Sánchez",
    reviewedAt: "2024-01-15 12:00",
  },
]

export default function IncapacidadesFamiliaPage() {
  const [incapacidades, setIncapacidades] = useState(mockIncapacidades)
  const [selectedHijo, setSelectedHijo] = useState<Hijo | null>(null)
  const [selectedIncapacidad, setSelectedIncapacidad] = useState<Incapacidad | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<"todas" | IncapacidadStatus>("todas")
  
  // Form state
  const [formHijo, setFormHijo] = useState("")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formReason, setFormReason] = useState("")
  const [formFile, setFormFile] = useState<File | null>(null)

  const filteredIncapacidades = incapacidades.filter((inc) => {
    const matchesHijo = !selectedHijo || inc.studentId === selectedHijo.id
    const matchesStatus = filterStatus === "todas" || inc.status === filterStatus
    return matchesHijo && matchesStatus
  })

  const pendingCount = incapacidades.filter((i) => i.status === "pendiente").length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const hijo = hijos.find((h) => h.id === formHijo)
    if (!hijo) return

    const newIncapacidad: Incapacidad = {
      id: String(incapacidades.length + 1),
      studentId: hijo.id,
      studentName: hijo.name,
      startDate: formStartDate,
      endDate: formEndDate,
      reason: formReason,
      document: formFile?.name || "",
      documentType: formFile?.type.includes("pdf") ? "PDF" : formFile?.type.includes("image") ? "Imagen" : "",
      submittedAt: new Date().toLocaleString("es-ES"),
      status: "pendiente",
      notes: "",
      reviewedBy: "",
      reviewedAt: "",
    }

    setIncapacidades((prev) => [newIncapacidad, ...prev])
    setShowNewForm(false)
    setFormHijo("")
    setFormStartDate("")
    setFormEndDate("")
    setFormReason("")
    setFormFile(null)
  }

  const getStatusConfig = (status: IncapacidadStatus) => {
    switch (status) {
      case "pendiente":
        return { bg: "bg-amber-100", text: "text-amber-700", icon: AlertCircle, label: "Pendiente" }
      case "aprobada":
        return { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle2, label: "Aprobada" }
      case "rechazada":
        return { bg: "bg-red-100", text: "text-red-700", icon: XCircle, label: "Rechazada" }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Incapacidades Médicas</h1>
              <p className="mt-1 text-muted-foreground">
                Gestiona las incapacidades y justificantes médicos de tus hijos
              </p>
            </div>
            <Button className="gap-2" onClick={() => setShowNewForm(true)}>
              <Plus className="h-4 w-4" />
              Nueva Incapacidad
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                    <FileText className="h-6 w-6 text-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{incapacidades.length}</p>
                    <p className="text-sm text-muted-foreground">Total enviadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                    <p className="text-sm text-muted-foreground">En revisión</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{incapacidades.filter((i) => i.status === "aprobada").length}</p>
                    <p className="text-sm text-muted-foreground">Aprobadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{incapacidades.filter((i) => i.status === "rechazada").length}</p>
                    <p className="text-sm text-muted-foreground">Rechazadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* New Incapacidad Form Modal */}
          {showNewForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <Card className="w-full max-w-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Nueva Incapacidad</CardTitle>
                      <CardDescription>Registra una incapacidad médica para tu hijo/a</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setShowNewForm(false)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="hijo">Hijo/a *</Label>
                      <select
                        id="hijo"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={formHijo}
                        onChange={(e) => setFormHijo(e.target.value)}
                        required
                      >
                        <option value="">Seleccionar...</option>
                        {hijos.map((hijo) => (
                          <option key={hijo.id} value={hijo.id}>
                            {hijo.name} - {hijo.grade} {hijo.section}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Fecha de inicio *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">Fecha de fin *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">Motivo de la incapacidad *</Label>
                      <Textarea
                        id="reason"
                        placeholder="Describe el motivo médico..."
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        rows={3}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Documento médico</Label>
                      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                        {formFile ? (
                          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm text-foreground">{formFile.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setFormFile(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Arrastra tu archivo o haz clic para seleccionar
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              PDF, JPG o PNG - Máximo 10MB
                            </p>
                            <label className="mt-3 inline-block">
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                              />
                              <span className="cursor-pointer rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                                Seleccionar Archivo
                              </span>
                            </label>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Adjuntar un certificado médico aumenta la probabilidad de aprobación
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowNewForm(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="flex-1 gap-2">
                        <Upload className="h-4 w-4" />
                        Enviar Solicitud
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Hijos Filter */}
            <div className="flex gap-2 overflow-x-auto">
              <Button
                variant={!selectedHijo ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedHijo(null)}
              >
                Todos mis hijos
              </Button>
              {hijos.map((hijo) => (
                <Button
                  key={hijo.id}
                  variant={selectedHijo?.id === hijo.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedHijo(hijo)}
                  className="gap-2"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs">
                    {hijo.avatar}
                  </div>
                  {hijo.name.split(" ")[0]}
                </Button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex rounded-lg border border-input bg-background p-1">
              {(["todas", "pendiente", "aprobada", "rechazada"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filterStatus === status
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status === "todas" ? "Todas" : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Incapacidades Grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* List */}
            <div className="space-y-4">
              {filteredIncapacidades.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Heart className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg font-medium text-foreground">No hay incapacidades</p>
                    <p className="mt-1 text-center text-sm text-muted-foreground">
                      No se encontraron incapacidades con los filtros actuales
                    </p>
                    <Button className="mt-4 gap-2" onClick={() => setShowNewForm(true)}>
                      <Plus className="h-4 w-4" />
                      Crear Nueva Incapacidad
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredIncapacidades.map((inc) => {
                  const statusConfig = getStatusConfig(inc.status)
                  const StatusIcon = statusConfig.icon
                  const hijo = hijos.find((h) => h.id === inc.studentId)

                  return (
                    <Card
                      key={inc.id}
                      className={`cursor-pointer transition-all ${
                        selectedIncapacidad?.id === inc.id ? "ring-2 ring-primary" : "hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedIncapacidad(inc)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                              {hijo?.avatar}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{inc.studentName}</p>
                              <p className="text-sm text-muted-foreground">
                                {hijo?.grade} {hijo?.section}
                              </p>
                            </div>
                          </div>
                          <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">
                              {inc.startDate === inc.endDate
                                ? inc.startDate
                                : `${inc.startDate} - ${inc.endDate}`}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{inc.reason}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Enviado: {inc.submittedAt}
                          </span>
                          {inc.document && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {inc.documentType}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>

            {/* Detail Panel */}
            <div className="lg:sticky lg:top-6">
              {selectedIncapacidad ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Detalle de Incapacidad</CardTitle>
                      {(() => {
                        const config = getStatusConfig(selectedIncapacidad.status)
                        const Icon = config.icon
                        return (
                          <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${config.bg} ${config.text}`}>
                            <Icon className="h-4 w-4" />
                            {config.label}
                          </span>
                        )
                      })()}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Student Info */}
                    {(() => {
                      const hijo = hijos.find((h) => h.id === selectedIncapacidad.studentId)
                      return (
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                            {hijo?.avatar}
                          </div>
                          <div>
                            <p className="text-lg font-medium text-foreground">{selectedIncapacidad.studentName}</p>
                            <p className="text-sm text-muted-foreground">{hijo?.grade} {hijo?.section}</p>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Dates */}
                    <div className="space-y-3 rounded-lg bg-muted p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Fecha de inicio</span>
                        <span className="font-medium text-foreground">{selectedIncapacidad.startDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Fecha de fin</span>
                        <span className="font-medium text-foreground">{selectedIncapacidad.endDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Días totales</span>
                        <span className="font-medium text-foreground">
                          {Math.ceil((new Date(selectedIncapacidad.endDate).getTime() - new Date(selectedIncapacidad.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} día(s)
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <Label className="text-sm text-muted-foreground">Motivo</Label>
                      <p className="mt-1 text-foreground">{selectedIncapacidad.reason}</p>
                    </div>

                    {/* Document */}
                    {selectedIncapacidad.document ? (
                      <div>
                        <Label className="text-sm text-muted-foreground">Documento Adjunto</Label>
                        <div className="mt-2 flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                              <FileText className="h-5 w-5 text-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{selectedIncapacidad.document}</p>
                              <p className="text-xs text-muted-foreground">{selectedIncapacidad.documentType}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="gap-1">
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Sin documento adjunto</p>
                            <p className="text-xs text-amber-700">
                              Las incapacidades sin certificado médico pueden ser rechazadas
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <Label className="text-sm text-muted-foreground">Historial</Label>
                      <div className="mt-2 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                            <Upload className="h-3 w-3 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Solicitud enviada</p>
                            <p className="text-xs text-muted-foreground">{selectedIncapacidad.submittedAt}</p>
                          </div>
                        </div>
                        
                        {selectedIncapacidad.status !== "pendiente" && (
                          <div className="flex items-start gap-3">
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              selectedIncapacidad.status === "aprobada" ? "bg-green-100" : "bg-red-100"
                            }`}>
                              {selectedIncapacidad.status === "aprobada" ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {selectedIncapacidad.status === "aprobada" ? "Aprobada" : "Rechazada"} por {selectedIncapacidad.reviewedBy}
                              </p>
                              <p className="text-xs text-muted-foreground">{selectedIncapacidad.reviewedAt}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {selectedIncapacidad.notes && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Notas del Profesor</Label>
                        <p className={`mt-1 rounded-lg p-3 text-sm ${
                          selectedIncapacidad.status === "aprobada" 
                            ? "bg-green-50 text-green-700" 
                            : selectedIncapacidad.status === "rechazada"
                            ? "bg-red-50 text-red-700"
                            : "bg-muted text-foreground"
                        }`}>
                          {selectedIncapacidad.notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {selectedIncapacidad.status === "pendiente" && (
                      <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 gap-2 text-red-600 hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                          Cancelar Solicitud
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg font-medium text-foreground">Selecciona una incapacidad</p>
                    <p className="mt-1 text-center text-sm text-muted-foreground">
                      Haz clic en una incapacidad de la lista para ver sus detalles
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Tips Card */}
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Consejos para una solicitud exitosa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    "Adjunta siempre un certificado médico válido",
                    "Especifica claramente las fechas de ausencia",
                    "Describe el motivo médico de forma clara",
                    "Envía la solicitud con anticipación cuando sea posible",
                  ].map((tip, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">{tip}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
