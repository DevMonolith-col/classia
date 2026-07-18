"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FileText,
  Users,
  GraduationCap,
  TrendingUp,
  Calendar,
  Eye,
  Mail,
  Clock,
  BookOpen,
  ClipboardCheck,
  Wallet,
  Download,
  RefreshCw,
  AlertCircle,
  Trash2,
  Pencil,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GroupCombobox, type GroupOption } from "@/components/admin/group-combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ReportType = "ATTENDANCE" | "GRADES" | "STUDENTS" | "TEACHERS" | "COURSES" | "FINANCIAL"
type ReportFormat = "PDF" | "CSV"
type ReportStatus = "PENDING" | "READY" | "FAILED"

type AcademicYear = { id: string; name: string; isActive: boolean }

type GeneratedReport = {
  id: string
  type: ReportType
  format: ReportFormat
  status: ReportStatus
  errorMessage: string | null
  downloadCount: number
  createdAt: string
}

type FrequencyType = "DAYS" | "MONTHLY"

type ReportSchedule = {
  id: string
  type: ReportType
  format: ReportFormat
  frequencyType: FrequencyType
  intervalValue: number
  dayOfMonth: number | null
  recipients: string[]
  active: boolean
  totalRuns: number
  emailsSent: number
  lastRunAt: string | null
}

type PreviewTable = { summary: Record<string, string | number>; columns: { key: string; label: string }[]; rows: Record<string, string | number>[] }

const REPORT_TYPES: { id: ReportType; name: string; description: string; icon: any; color: string; showGroup: boolean; showYear: boolean; showDates: boolean }[] = [
  { id: "ATTENDANCE", name: "Reporte de Asistencia", description: "Presente/ausente/tarde por estudiante y curso", icon: ClipboardCheck, color: "bg-emerald-500", showGroup: true, showYear: false, showDates: true },
  { id: "GRADES", name: "Reporte de Calificaciones", description: "Promedios y materias reprobadas por estudiante", icon: TrendingUp, color: "bg-blue-500", showGroup: true, showYear: true, showDates: false },
  { id: "STUDENTS", name: "Reporte de Estudiantes", description: "Matrícula, estado y acudientes", icon: GraduationCap, color: "bg-purple-500", showGroup: true, showYear: false, showDates: false },
  { id: "TEACHERS", name: "Reporte de Profesores", description: "Carga de clases, asistencia y notas registradas", icon: Users, color: "bg-orange-500", showGroup: false, showYear: false, showDates: false },
  { id: "COURSES", name: "Reporte de Cursos", description: "Estudiantes y clases por curso", icon: BookOpen, color: "bg-cyan-500", showGroup: false, showYear: false, showDates: false },
  { id: "FINANCIAL", name: "Reporte Financiero", description: "Recaudo, pendiente y estudiantes en mora", icon: Wallet, color: "bg-amber-500", showGroup: true, showYear: true, showDates: true },
]

const STATUS_BADGE: Record<ReportStatus, { label: string; className: string }> = {
  PENDING: { label: "Generando...", className: "bg-amber-100 text-amber-700 border-amber-200" },
  READY: { label: "Listo", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  FAILED: { label: "Falló", className: "bg-red-100 text-red-700 border-red-200" },
}

const DAYS_PRESETS = [
  { label: "Semanal", value: 7 },
  { label: "Quincenal", value: 15 },
  { label: "Cada 30 días", value: 30 },
]
const HISTORY_PAGE_SIZE = 15

function formatFrequency(schedule: Pick<ReportSchedule, "frequencyType" | "intervalValue" | "dayOfMonth">) {
  if (schedule.frequencyType === "MONTHLY") {
    const cadence = schedule.intervalValue === 1 ? "Cada mes" : `Cada ${schedule.intervalValue} meses`
    return `${cadence}, día ${schedule.dayOfMonth}`
  }
  if (schedule.intervalValue === 7) return "Semanal (cada 7 días)"
  if (schedule.intervalValue === 15) return "Quincenal (cada 15 días)"
  return `Cada ${schedule.intervalValue} días`
}

type RecurrenceValue = { frequencyType: FrequencyType; intervalValue: number; dayOfMonth: number }

function RecurrenceFields({ value, onChange }: { value: RecurrenceValue; onChange: (next: RecurrenceValue) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Recurrencia</Label>
        <Select value={value.frequencyType} onValueChange={(v) => onChange({ ...value, frequencyType: v as FrequencyType })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="DAYS">Cada N días</SelectItem>
            <SelectItem value="MONTHLY">Cada N meses, en un día fijo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.frequencyType === "DAYS" ? (
        <div className="space-y-1.5">
          <Label>Cada cuántos días</Label>
          <Input
            type="number"
            min={1}
            max={180}
            value={value.intervalValue}
            onChange={(e) => onChange({ ...value, intervalValue: Number(e.target.value) || 1 })}
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {DAYS_PRESETS.map((p) => (
              <Button
                key={p.value}
                type="button"
                variant={value.intervalValue === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => onChange({ ...value, intervalValue: p.value })}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Cada cuántos meses</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={value.intervalValue}
              onChange={(e) => onChange({ ...value, intervalValue: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Día del mes</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={value.dayOfMonth}
              onChange={(e) => onChange({ ...value, dayOfMonth: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminReportesPage() {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null)
  const [format, setFormat] = useState<ReportFormat>("PDF")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [groupId, setGroupId] = useState<string | null>(null)
  const [academicYearId, setAcademicYearId] = useState<string>("")

  const [groups, setGroups] = useState<GroupOption[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])

  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewTable | null>(null)

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ frequencyType: "DAYS" as FrequencyType, intervalValue: 7, dayOfMonth: 1, recipients: "" })
  const [creatingSchedule, setCreatingSchedule] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<ReportSchedule | null>(null)
  const [scheduleToEdit, setScheduleToEdit] = useState<ReportSchedule | null>(null)
  const [scheduleEditForm, setScheduleEditForm] = useState({ frequencyType: "DAYS" as FrequencyType, intervalValue: 7, dayOfMonth: 1, recipients: "" })
  const [savingScheduleEdit, setSavingScheduleEdit] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<ReportType | "">("")
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ReportStatus | "">("")
  const [historyPage, setHistoryPage] = useState(0)

  const activeType = REPORT_TYPES.find((t) => t.id === selectedType)

  const load = useCallback(async () => {
    const [reportsRes, schedulesRes] = await Promise.all([
      apiFetch("/reports", { silent: true }),
      apiFetch("/report-schedules", { silent: true }),
    ])
    if (reportsRes.ok) setReports(await reportsRes.json())
    if (schedulesRes.ok) setSchedules(await schedulesRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    apiFetch("/groups", { silent: true }).then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { id: string; name: string; grade: string; section: string }[]
      setGroups(data.map((g) => ({ id: g.id, name: g.name, grade: g.grade, section: g.section })))
    })
    apiFetch("/academic-years", { silent: true }).then(async (res) => {
      if (!res.ok) return
      const years = (await res.json()) as AcademicYear[]
      setAcademicYears(years)
      const active = years.find((y) => y.isActive)
      if (active) setAcademicYearId(active.id)
    })
  }, [load])

  // Poll mientras haya reportes PENDING (el worker corre en segundo plano).
  useEffect(() => {
    const hasPending = reports.some((r) => r.status === "PENDING")
    if (!hasPending) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [reports, load])

  const buildFilters = useCallback(() => {
    const filters: Record<string, string> = {}
    if (activeType?.showDates && dateFrom) filters.from = new Date(dateFrom).toISOString()
    if (activeType?.showDates && dateTo) filters.to = new Date(dateTo).toISOString()
    if (activeType?.showGroup && groupId) filters.groupId = groupId
    if (activeType?.showYear && academicYearId) filters.academicYearId = academicYearId
    return filters
  }, [activeType, dateFrom, dateTo, groupId, academicYearId])

  const generate = async () => {
    if (!selectedType) return
    setGenerating(true)
    try {
      const res = await apiFetch("/reports", {
        method: "POST",
        body: JSON.stringify({ type: selectedType, format, filters: buildFilters() }),
      })
      if (!res.ok) throw new Error("No se pudo generar el reporte")
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setGenerating(false)
    }
  }

  const preview = async () => {
    if (!selectedType) return
    setPreviewing(true)
    try {
      const res = await apiFetch("/reports/preview", {
        method: "POST",
        body: JSON.stringify({ type: selectedType, format, filters: buildFilters() }),
      })
      if (!res.ok) throw new Error("No se pudo generar la vista previa")
      setPreviewData(await res.json())
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setPreviewing(false)
    }
  }

  const download = async (id: string) => {
    const res = await apiFetch(`/reports/${id}/status`, { silent: true })
    if (!res.ok) return
    const body = await res.json()
    if (body.downloadUrl) window.open(body.downloadUrl, "_blank")
    load()
  }

  const createSchedule = async () => {
    if (!selectedType) return
    const recipients = scheduleForm.recipients
      .split(/[,\n]/)
      .map((r) => r.trim())
      .filter(Boolean)
    if (recipients.length === 0) return
    setCreatingSchedule(true)
    try {
      const res = await apiFetch("/report-schedules", {
        method: "POST",
        body: JSON.stringify({
          type: selectedType,
          format,
          filters: buildFilters(),
          frequencyType: scheduleForm.frequencyType,
          intervalValue: scheduleForm.intervalValue,
          ...(scheduleForm.frequencyType === "MONTHLY" ? { dayOfMonth: scheduleForm.dayOfMonth } : {}),
          recipients,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo programar el reporte")
      }
      setScheduleOpen(false)
      setScheduleForm({ frequencyType: "DAYS", intervalValue: 7, dayOfMonth: 1, recipients: "" })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setCreatingSchedule(false)
    }
  }

  const toggleSchedule = async (schedule: ReportSchedule) => {
    const res = await apiFetch(`/report-schedules/${schedule.id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ active: !schedule.active }),
    })
    if (res.ok) load()
  }

  const confirmDeleteSchedule = async () => {
    if (!scheduleToDelete) return
    const res = await apiFetch(`/report-schedules/${scheduleToDelete.id}`, { method: "DELETE" })
    setScheduleToDelete(null)
    if (res.ok) load()
  }

  const stats = useMemo(() => {
    return {
      generated: reports.length,
      scheduled: schedules.filter((s) => s.active).length,
      downloads: reports.reduce((sum, r) => sum + r.downloadCount, 0),
      emailsSent: schedules.reduce((sum, s) => sum + s.emailsSent, 0),
    }
  }, [reports, schedules])

  const typeLabel = (type: ReportType) => REPORT_TYPES.find((t) => t.id === type)?.name ?? type

  const filteredHistory = useMemo(() => {
    return reports.filter((r) => (!historyTypeFilter || r.type === historyTypeFilter) && (!historyStatusFilter || r.status === historyStatusFilter))
  }, [reports, historyTypeFilter, historyStatusFilter])

  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE))
  const historyPageItems = filteredHistory.slice(historyPage * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE)

  const clearHistoryFilters = () => {
    setHistoryTypeFilter("")
    setHistoryStatusFilter("")
    setHistoryPage(0)
  }

  const openScheduleEdit = (schedule: ReportSchedule) => {
    setScheduleToEdit(schedule)
    setScheduleEditForm({
      frequencyType: schedule.frequencyType,
      intervalValue: schedule.intervalValue,
      dayOfMonth: schedule.dayOfMonth ?? 1,
      recipients: schedule.recipients.join(", "),
    })
  }

  const saveScheduleEdit = async () => {
    if (!scheduleToEdit) return
    const recipients = scheduleEditForm.recipients
      .split(/[,\n]/)
      .map((r) => r.trim())
      .filter(Boolean)
    if (recipients.length === 0) return
    setSavingScheduleEdit(true)
    try {
      const res = await apiFetch(`/report-schedules/${scheduleToEdit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          frequencyType: scheduleEditForm.frequencyType,
          intervalValue: scheduleEditForm.intervalValue,
          ...(scheduleEditForm.frequencyType === "MONTHLY" ? { dayOfMonth: scheduleEditForm.dayOfMonth } : {}),
          recipients,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo guardar la programación")
      }
      setScheduleToEdit(null)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setSavingScheduleEdit(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reportes</h1>
        <p className="mt-1 text-muted-foreground">Genera y descarga reportes con datos reales de tu institución.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary"><FileText className="h-6 w-6 text-foreground" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.generated}</p><p className="text-sm text-muted-foreground">Reportes Generados</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary"><Clock className="h-6 w-6 text-foreground" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.scheduled}</p><p className="text-sm text-muted-foreground">Programados</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary"><Download className="h-6 w-6 text-foreground" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.downloads}</p><p className="text-sm text-muted-foreground">Descargas</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary"><Mail className="h-6 w-6 text-foreground" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.emailsSent}</p><p className="text-sm text-muted-foreground">Enviados por Email</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Tipos de Reporte</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_TYPES.map((report) => (
            <Card
              key={report.id}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedType === report.id ? "ring-2 ring-primary" : ""}`}
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

      {activeType && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Configurar {activeType.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {activeType.showDates && (
                <>
                  <div>
                    <Label className="mb-2 block">Fecha Inicio</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-2 block">Fecha Fin</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </>
              )}
              {activeType.showGroup && (
                <div>
                  <Label className="mb-2 block">Curso</Label>
                  <GroupCombobox groups={groups} value={groupId} onChange={setGroupId} />
                </div>
              )}
              {activeType.showYear && (
                <div>
                  <Label className="mb-2 block">Año académico</Label>
                  <Select value={academicYearId} onValueChange={setAcademicYearId}>
                    <SelectTrigger><SelectValue placeholder="Vigente" /></SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? " (vigente)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="mb-2 block">Formato</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="CSV">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={generate} disabled={generating} className="gap-2">
                <FileText className="h-4 w-4" /> {generating ? "Generando..." : "Generar Reporte"}
              </Button>
              <Button variant="outline" onClick={preview} disabled={previewing} className="gap-2">
                <Eye className="h-4 w-4" /> {previewing ? "Cargando..." : "Vista Previa"}
              </Button>
              <Button variant="outline" onClick={() => setScheduleOpen(true)} className="gap-2">
                <Calendar className="h-4 w-4" /> Programar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reportes Recientes</CardTitle>
            {reports.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setHistoryPage(0); setHistoryOpen(true) }}>Ver todos</Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no se ha generado ningún reporte.</p>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 5).map((report) => {
                  const status = STATUS_BADGE[report.status]
                  return (
                    <div key={report.id} className="flex items-center gap-4 rounded-lg border border-border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <FileText className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-foreground">{typeLabel(report.type)}</p>
                          <Badge variant="outline" className={status.className}>
                            {report.status === "PENDING" && <RefreshCw className="mr-1 h-3 w-3 animate-spin" />}
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {report.format} · {new Date(report.createdAt).toLocaleDateString("es-CO")} · {report.downloadCount} descargas
                        </p>
                        {report.status === "FAILED" && report.errorMessage && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" /> {report.errorMessage}</p>
                        )}
                      </div>
                      {report.status === "READY" && (
                        <Button variant="ghost" size="icon" onClick={() => download(report.id)} title="Descargar">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reportes Programados</CardTitle>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">Configura reportes automáticos</p>
                <p className="mt-1 text-xs text-muted-foreground">Elegí un tipo de reporte arriba y hacé clic en "Programar".</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-4 rounded-lg border border-border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <Calendar className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{typeLabel(schedule.type)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFrequency(schedule)} · {schedule.recipients.length} destinatario{schedule.recipients.length === 1 ? "" : "s"}
                        {schedule.lastRunAt && ` · último envío ${new Date(schedule.lastRunAt).toLocaleDateString("es-CO")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={schedule.active} onCheckedChange={() => toggleSchedule(schedule)} />
                      <Button variant="ghost" size="icon" onClick={() => openScheduleEdit(schedule)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setScheduleToDelete(schedule)} title="Eliminar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(previewData)} onOpenChange={(open) => !open && setPreviewData(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vista previa{activeType ? ` — ${activeType.name}` : ""}</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Object.entries(previewData.summary).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      {previewData.columns.map((c) => (
                        <th key={c.key} className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewData.rows.length === 0 ? (
                      <tr><td className="px-3 py-4 text-center text-muted-foreground" colSpan={previewData.columns.length}>Sin datos para estos filtros.</td></tr>
                    ) : (
                      previewData.rows.map((row, i) => (
                        <tr key={i}>
                          {previewData.columns.map((c) => (
                            <td key={c.key} className="px-3 py-2">{row[c.key] ?? ""}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de reportes</DialogTitle>
            <DialogDescription>Buscá un reporte ya generado antes de crear uno nuevo con los mismos filtros.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={historyTypeFilter || "ALL"} onValueChange={(v) => { setHistoryTypeFilter(v === "ALL" ? "" : (v as ReportType)); setHistoryPage(0) }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={historyStatusFilter || "ALL"} onValueChange={(v) => { setHistoryStatusFilter(v === "ALL" ? "" : (v as ReportStatus)); setHistoryPage(0) }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="PENDING">Generando</SelectItem>
                <SelectItem value="READY">Listo</SelectItem>
                <SelectItem value="FAILED">Falló</SelectItem>
              </SelectContent>
            </Select>
            {(historyTypeFilter || historyStatusFilter) && (
              <Button variant="ghost" size="sm" onClick={clearHistoryFilters}>Eliminar filtros</Button>
            )}
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-auto">
            {historyPageItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay reportes para este filtro.</p>
            ) : (
              historyPageItems.map((report) => {
                const status = STATUS_BADGE[report.status]
                return (
                  <div key={report.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <FileText className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{typeLabel(report.type)}</p>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {report.format} · {new Date(report.createdAt).toLocaleDateString("es-CO")} · {report.downloadCount} descargas
                      </p>
                    </div>
                    {report.status === "READY" && (
                      <Button variant="ghost" size="icon" onClick={() => download(report.id)} title="Descargar">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
          {historyPageCount > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button variant="outline" size="sm" disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)}>Anterior</Button>
              <span className="text-xs text-muted-foreground">Página {historyPage + 1} de {historyPageCount}</span>
              <Button variant="outline" size="sm" disabled={historyPage >= historyPageCount - 1} onClick={() => setHistoryPage((p) => p + 1)}>Siguiente</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar {activeType?.name}</DialogTitle>
            <DialogDescription>Se genera automáticamente y se envía por email a los destinatarios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RecurrenceFields value={scheduleForm} onChange={(next) => setScheduleForm((f) => ({ ...f, ...next }))} />
            <div className="space-y-1.5">
              <Label>Destinatarios</Label>
              <Input
                value={scheduleForm.recipients}
                onChange={(e) => setScheduleForm((f) => ({ ...f, recipients: e.target.value }))}
                placeholder="rectoria@colegio.edu.co, secretaria@colegio.edu.co"
              />
              <p className="text-xs text-muted-foreground">Separá varios correos con comas.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createSchedule} disabled={creatingSchedule}>{creatingSchedule ? "Programando..." : "Programar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(scheduleToEdit)} onOpenChange={(open) => !open && setScheduleToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar programación</DialogTitle>
            <DialogDescription>{scheduleToEdit ? typeLabel(scheduleToEdit.type) : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RecurrenceFields value={scheduleEditForm} onChange={(next) => setScheduleEditForm((f) => ({ ...f, ...next }))} />
            <div className="space-y-1.5">
              <Label>Destinatarios</Label>
              <Input
                value={scheduleEditForm.recipients}
                onChange={(e) => setScheduleEditForm((f) => ({ ...f, recipients: e.target.value }))}
                placeholder="rectoria@colegio.edu.co, secretaria@colegio.edu.co"
              />
              <p className="text-xs text-muted-foreground">Separá varios correos con comas.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveScheduleEdit} disabled={savingScheduleEdit}>{savingScheduleEdit ? "Guardando..." : "Guardar cambios"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(scheduleToDelete)} onOpenChange={(open) => !open && setScheduleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta programación?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de generar y enviar {scheduleToDelete ? typeLabel(scheduleToDelete.type) : ""} automáticamente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSchedule}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
