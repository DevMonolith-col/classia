import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { AttendanceStatus, ReportFrequencyType, ReportType, UserRole } from "@prisma/client"
import { Request } from "express"
import { RequestUser } from "../../common/types/request-context"
import { AuditService } from "../../core/audit/audit.service"
import { buildJobId } from "../../core/queue/job-id"
import { PlatformAdminPrismaService } from "../../core/prisma/platform-admin-prisma.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service"
import { StorageService } from "../../core/storage/storage.service"
import { ReportCardsService } from "../report-cards/report-cards.service"
import { PaymentsService } from "../payments/payments.service"
import { CreateScheduleInput, GenerateReportInput, ReportFilters, UpdateScheduleInput } from "./reports.schemas"
import { computeNextRun } from "./reports.recurrence"

export const REPORTS_QUEUE = "reports"

// Igual que en certificados: reintentos con backoff exponencial ante fallas
// transitorias (Chromium reiniciado, pico de memoria momentáneo).
export const REPORT_JOB_OPTIONS = { attempts: 3, backoff: { type: "exponential" as const, delay: 5_000 } }

const REPORT_LIST_PAGE_SIZE = 200
const SCHEDULE_LIST_PAGE_SIZE = 100

export type ReportTable = {
  summary: Record<string, string | number>
  columns: { key: string; label: string }[]
  rows: Record<string, string | number>[]
}

// Campos mínimos para (re)programar una corrida. El registro completo de
// ReportSchedule es un superconjunto de esto, así que los llamadores pasan el
// registro tal cual.
type SchedulableRecord = {
  id: string
  tenantId: string
  frequencyType: ReportFrequencyType
  intervalValue: number
  dayOfMonth: number | null
  createdAt: Date
  nextRunAt: Date | null
}

const SCHEDULABLE_SELECT = {
  id: true,
  tenantId: true,
  frequencyType: true,
  intervalValue: true,
  dayOfMonth: true,
  createdAt: true,
  nextRunAt: true,
} as const

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  ATTENDANCE: "Reporte de Asistencia",
  GRADES: "Reporte de Calificaciones",
  STUDENTS: "Reporte de Estudiantes",
  TEACHERS: "Reporte de Profesores",
  COURSES: "Reporte de Cursos",
  FINANCIAL: "Reporte Financiero",
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly reportCards: ReportCardsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly platformAdmin: PlatformAdminPrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
    @InjectQueue(REPORTS_QUEUE) private readonly queue: Queue,
  ) {}

  // ─── Ciclo de vida del reporte ────────────────────────────────────────────────

  async generate(actor: RequestUser, data: GenerateReportInput) {
    this.assertTenant(actor)

    const report = await this.prisma.generatedReport.create({
      data: {
        tenantId: actor.tenantId,
        type: data.type,
        format: data.format,
        filters: this.filtersToJson(data.filters),
        requestedById: actor.id,
      },
    })

    await this.queue.add("generate", { reportId: report.id, tenantId: actor.tenantId }, REPORT_JOB_OPTIONS)
    return report
  }

  async preview(actor: RequestUser, data: GenerateReportInput) {
    this.assertTenant(actor)
    return this.buildData(data.type, actor.tenantId, data.filters, actor)
  }

  async list(actor: RequestUser) {
    this.assertTenant(actor)
    return this.prisma.generatedReport.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: "desc" },
      take: REPORT_LIST_PAGE_SIZE,
    })
  }

  async getStatus(reportId: string, actor: RequestUser) {
    const report = await this.findReportOrThrow(reportId, actor.tenantId)
    if (report.status !== "READY" || !report.fileKey) {
      return { ...report, downloadUrl: null }
    }
    await this.prisma.generatedReport.update({ where: { id: reportId }, data: { downloadCount: { increment: 1 } } })
    const downloadUrl = await this.storage.getSignedDownloadUrl(report.fileKey)
    return { ...report, downloadUrl }
  }

  // ─── Programación recurrente ──────────────────────────────────────────────────

  async createSchedule(actor: RequestUser, data: CreateScheduleInput, request: Request) {
    this.assertTenant(actor)

    const schedule = await this.prisma.reportSchedule.create({
      data: {
        tenantId: actor.tenantId,
        type: data.type,
        format: data.format,
        filters: this.filtersToJson(data.filters),
        frequencyType: data.frequencyType,
        intervalValue: data.intervalValue,
        dayOfMonth: data.frequencyType === "MONTHLY" ? data.dayOfMonth : null,
        recipients: data.recipients,
        createdById: actor.id,
      },
    })

    await this.scheduleNextRun(schedule, new Date())

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "reports.schedule_created",
      entityType: "ReportSchedule",
      entityId: schedule.id,
      newValues: { type: schedule.type, frequencyType: schedule.frequencyType, intervalValue: schedule.intervalValue, recipients: schedule.recipients },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return schedule
  }

  async listSchedules(actor: RequestUser) {
    this.assertTenant(actor)
    return this.prisma.reportSchedule.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: "desc" },
      take: SCHEDULE_LIST_PAGE_SIZE,
    })
  }

  async toggleSchedule(scheduleId: string, actor: RequestUser, active: boolean) {
    await this.findScheduleOrThrow(scheduleId, actor.tenantId)
    const updated = await this.prisma.reportSchedule.update({ where: { id: scheduleId }, data: { active } })
    if (active) {
      await this.scheduleNextRun(updated, new Date())
    } else {
      await this.removeScheduler(updated)
    }
    return updated
  }

  async updateSchedule(scheduleId: string, actor: RequestUser, data: UpdateScheduleInput, request: Request) {
    const schedule = await this.findScheduleOrThrow(scheduleId, actor.tenantId)
    const updated = await this.prisma.reportSchedule.update({
      where: { id: scheduleId },
      data: {
        frequencyType: data.frequencyType,
        intervalValue: data.intervalValue,
        dayOfMonth: data.frequencyType === "MONTHLY" ? data.dayOfMonth : null,
        recipients: data.recipients,
      },
    })
    // La recurrencia depende de estos campos: si cambiaron, hay que recalcular la
    // próxima corrida (el job diferido anterior se elimina dentro de scheduleNextRun).
    if (updated.active) {
      await this.scheduleNextRun(updated, new Date())
    }

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "reports.schedule_updated",
      entityType: "ReportSchedule",
      entityId: scheduleId,
      oldValues: { frequencyType: schedule.frequencyType, intervalValue: schedule.intervalValue, dayOfMonth: schedule.dayOfMonth, recipients: schedule.recipients },
      newValues: { frequencyType: updated.frequencyType, intervalValue: updated.intervalValue, dayOfMonth: updated.dayOfMonth, recipients: updated.recipients },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  async deleteSchedule(scheduleId: string, actor: RequestUser, request: Request) {
    const schedule = await this.findScheduleOrThrow(scheduleId, actor.tenantId)
    await this.removeScheduler(schedule)
    await this.prisma.reportSchedule.delete({ where: { id: scheduleId } })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "reports.schedule_deleted",
      entityType: "ReportSchedule",
      entityId: scheduleId,
      oldValues: { type: schedule.type, frequencyType: schedule.frequencyType, intervalValue: schedule.intervalValue },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return { status: "ok" as const }
  }

  // Se llama una vez al boot (ver ReportsModule.onModuleInit) por si Redis
  // perdió el estado de los schedulers entre reinicios. Corre sin contexto
  // de request (no hay tenant "actual" al arrancar la app) y necesita ver
  // los schedules activos de TODOS los colegios -- por eso usa el cliente
  // de bypass (classia_platform_admin) en vez de this.prisma.
  async reconcileSchedulers() {
    const schedules = await this.platformAdmin.get().reportSchedule.findMany({
      where: { active: true },
      select: SCHEDULABLE_SELECT,
    })
    for (const s of schedules) {
      await this.scheduleNextRun(s, new Date())
    }
  }

  // Reprograma la próxima corrida tras ejecutarse una (lo llama el processor).
  // `after` es el instante de la ocurrencia que acaba de correr, para que el
  // cálculo sea determinista ante reintentos de BullMQ.
  async rescheduleAfterRun(scheduleId: string, after: Date) {
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id: scheduleId },
      select: { ...SCHEDULABLE_SELECT, active: true },
    })
    if (!schedule || !schedule.active) return
    await this.scheduleNextRun(schedule, after)
  }

  // Calcula la próxima corrida (anclada a createdAt y a la zona horaria del
  // colegio) y encola un job diferido one-off con jobId por-ocurrencia. Antes se
  // usaba un scheduler repetible de BullMQ con cron `*/N` en el campo mes, que
  // significaba "meses divisibles por N desde enero" (mal para N que no divide 12)
  // y corría en UTC en vez de la hora local.
  private async scheduleNextRun(schedule: SchedulableRecord, after: Date) {
    // Limpia cualquier job pendiente anterior (y el scheduler repetible del diseño
    // viejo, si quedó en Redis).
    await this.removeScheduler(schedule)

    const tz = await this.tenantTimezone(schedule.tenantId)
    const nextRunAt = computeNextRun(
      {
        frequencyType: schedule.frequencyType,
        intervalValue: schedule.intervalValue,
        dayOfMonth: schedule.dayOfMonth,
        createdAt: schedule.createdAt,
      },
      tz,
      after,
    )

    const delay = Math.max(0, nextRunAt.getTime() - Date.now())
    await this.queue.add(
      "scheduled-run",
      { scheduleId: schedule.id, scheduledFor: nextRunAt.toISOString(), tenantId: schedule.tenantId },
      { jobId: this.schedulerJobId(schedule.id, nextRunAt), delay, ...REPORT_JOB_OPTIONS },
    )

    // Este método se llama tanto desde un request HTTP (que ya trae contexto
    // de tenant) como desde reconcileSchedulers() al boot (sin contexto,
    // recorriendo TODOS los colegios) -- se establece acá explícitamente
    // para que el write funcione en ambos casos, sin asumir el del caller.
    await this.tenantRlsContext.runWithTenant(schedule.tenantId, () =>
      this.prisma.reportSchedule.update({ where: { id: schedule.id }, data: { nextRunAt } }),
    )
  }

  private async removeScheduler(schedule: SchedulableRecord) {
    // Scheduler repetible del diseño anterior (por si quedó registrado en Redis).
    await this.queue.removeJobScheduler(`schedule:${schedule.id}`).catch(() => {})
    // Job diferido pendiente de la ocurrencia actual.
    if (schedule.nextRunAt) {
      await this.queue.remove(this.schedulerJobId(schedule.id, schedule.nextRunAt)).catch(() => {})
    }
  }

  private schedulerJobId(scheduleId: string, runAt: Date) {
    // Antes: `schedule:${scheduleId}:${runAt.getTime()}` — BullMQ rechaza ":"
    // en un jobId personalizado ("Custom Id cannot contain :"), así que esto
    // nunca había logrado programar un reporte con éxito (0 filas en
    // report_schedules, sin rastro en Redis). Ver core/queue/job-id.ts.
    return buildJobId("schedule", scheduleId, runAt.getTime())
  }

  private async tenantTimezone(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } })
    return tenant?.timezone || "America/Bogota"
  }

  // ─── Builders por tipo (usados por preview() y por el worker) ────────────────

  async buildData(type: ReportType, tenantId: string, filters: ReportFilters, actor: RequestUser): Promise<ReportTable> {
    switch (type) {
      case "ATTENDANCE":
        return this.buildAttendanceData(tenantId, filters)
      case "GRADES":
        return this.buildGradesData(tenantId, filters, actor)
      case "STUDENTS":
        return this.buildStudentsData(tenantId, filters)
      case "TEACHERS":
        return this.buildTeachersData(tenantId)
      case "COURSES":
        return this.buildCoursesData(tenantId)
      case "FINANCIAL":
        return this.buildFinancialData(tenantId, filters, actor)
    }
  }

  reportLabel(type: ReportType) {
    return REPORT_TYPE_LABELS[type]
  }

  private async buildAttendanceData(tenantId: string, filters: ReportFilters): Promise<ReportTable> {
    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId,
        ...(filters.groupId ? { groupId: filters.groupId } : {}),
        ...(filters.from || filters.to
          ? { date: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
          : {}),
      },
      select: {
        records: {
          select: { status: true, student: { select: { id: true, firstName: true, lastName: true, group: { select: { grade: true, section: true } } } } },
        },
      },
    })

    const byStudent = new Map<
      string,
      { name: string; groupName: string; counts: Record<AttendanceStatus, number> }
    >()
    for (const session of sessions) {
      for (const record of session.records) {
        const key = record.student.id
        const groupName = record.student.group ? `${record.student.group.grade}${record.student.group.section}` : "Sin grupo"
        const entry = byStudent.get(key) ?? {
          name: `${record.student.firstName} ${record.student.lastName}`,
          groupName,
          counts: { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, PERMISSION: 0 },
        }
        entry.counts[record.status] += 1
        byStudent.set(key, entry)
      }
    }

    const rows = [...byStudent.values()]
      .map((s) => {
        const total = Object.values(s.counts).reduce((a, b) => a + b, 0)
        const rate = total > 0 ? Math.round((s.counts.PRESENT / total) * 1000) / 10 : 0
        return {
          estudiante: s.name,
          curso: s.groupName,
          presente: s.counts.PRESENT,
          ausente: s.counts.ABSENT,
          tarde: s.counts.LATE,
          justificado: s.counts.JUSTIFIED,
          permiso: s.counts.PERMISSION,
          asistencia_pct: rate,
        }
      })
      .sort((a, b) => a.estudiante.localeCompare(b.estudiante))

    const averageRate = rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.asistencia_pct, 0) / rows.length) * 10) / 10 : 0

    return {
      summary: { "Sesiones registradas": sessions.length, "Estudiantes": rows.length, "Asistencia promedio": `${averageRate}%` },
      columns: [
        { key: "estudiante", label: "Estudiante" },
        { key: "curso", label: "Curso" },
        { key: "presente", label: "Presente" },
        { key: "ausente", label: "Ausente" },
        { key: "tarde", label: "Tarde" },
        { key: "justificado", label: "Justificado" },
        { key: "permiso", label: "Permiso" },
        { key: "asistencia_pct", label: "% Asistencia" },
      ],
      rows,
    }
  }

  private async buildGradesData(tenantId: string, filters: ReportFilters, actor: RequestUser): Promise<ReportTable> {
    const students = await this.prisma.student.findMany({
      where: { tenantId, isActive: true, ...(filters.groupId ? { groupId: filters.groupId } : {}) },
      select: { id: true, firstName: true, lastName: true, group: { select: { grade: true, section: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    const rows: Record<string, string | number>[] = []
    let sum = 0
    let withAverage = 0
    let passing = 0
    for (const student of students) {
      const computed = await this.reportCards.compute(student.id, actor, filters.academicYearId)
      const groupName = student.group ? `${student.group.grade}${student.group.section}` : "Sin grupo"
      rows.push({
        estudiante: `${student.firstName} ${student.lastName}`,
        curso: groupName,
        promedio: computed.overallAverage ?? "-",
        escala: computed.scaleName,
        materias_reprobadas: computed.lines.filter((l) => l.passing === false).length,
      })
      if (computed.overallAverage !== null) {
        sum += computed.overallAverage
        withAverage += 1
        if (computed.overallAverage >= computed.passingValue) passing += 1
      }
    }

    return {
      summary: {
        Estudiantes: students.length,
        "Promedio general": withAverage > 0 ? (Math.round((sum / withAverage) * 100) / 100).toString() : "-",
        Aprobando: passing,
      },
      columns: [
        { key: "estudiante", label: "Estudiante" },
        { key: "curso", label: "Curso" },
        { key: "promedio", label: "Promedio" },
        { key: "escala", label: "Escala" },
        { key: "materias_reprobadas", label: "Materias reprobadas" },
      ],
      rows,
    }
  }

  private async buildStudentsData(tenantId: string, filters: ReportFilters): Promise<ReportTable> {
    const students = await this.prisma.student.findMany({
      where: { tenantId, ...(filters.groupId ? { groupId: filters.groupId } : {}) },
      select: {
        firstName: true,
        lastName: true,
        documentId: true,
        isActive: true,
        birthDate: true,
        group: { select: { grade: true, section: true } },
        _count: { select: { guardians: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    const rows = students.map((s) => ({
      estudiante: `${s.firstName} ${s.lastName}`,
      documento: s.documentId ?? "-",
      curso: s.group ? `${s.group.grade}${s.group.section}` : "Sin grupo",
      estado: s.isActive ? "Activo" : "Inactivo",
      acudientes: s._count.guardians,
    }))

    return {
      summary: {
        Total: students.length,
        Activos: students.filter((s) => s.isActive).length,
        Inactivos: students.filter((s) => !s.isActive).length,
      },
      columns: [
        { key: "estudiante", label: "Estudiante" },
        { key: "documento", label: "Documento" },
        { key: "curso", label: "Curso" },
        { key: "estado", label: "Estado" },
        { key: "acudientes", label: "Acudientes" },
      ],
      rows,
    }
  }

  private async buildTeachersData(tenantId: string): Promise<ReportTable> {
    const teachers = await this.prisma.teacher.findMany({
      where: { tenantId },
      select: {
        user: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { schedules: true, attendanceSessions: true, marks: true, homework: true } },
      },
      orderBy: [{ user: { firstName: "asc" } }],
    })

    const rows = teachers.map((t) => ({
      profesor: `${t.user.firstName} ${t.user.lastName}`,
      correo: t.user.email,
      clases_asignadas: t._count.schedules,
      sesiones_asistencia: t._count.attendanceSessions,
      notas_registradas: t._count.marks,
      tareas_asignadas: t._count.homework,
    }))

    return {
      summary: { Profesores: teachers.length },
      columns: [
        { key: "profesor", label: "Profesor" },
        { key: "correo", label: "Correo" },
        { key: "clases_asignadas", label: "Clases asignadas" },
        { key: "sesiones_asistencia", label: "Sesiones de asistencia" },
        { key: "notas_registradas", label: "Notas registradas" },
        { key: "tareas_asignadas", label: "Tareas asignadas" },
      ],
      rows,
    }
  }

  private async buildCoursesData(tenantId: string): Promise<ReportTable> {
    const groups = await this.prisma.group.findMany({
      where: { tenantId },
      select: { name: true, grade: true, section: true, _count: { select: { students: true, schedules: true, attendanceSessions: true } } },
      orderBy: [{ grade: "asc" }, { section: "asc" }],
    })

    const rows = groups.map((g) => ({
      curso: `${g.grade}${g.section}`,
      nombre: g.name,
      estudiantes: g._count.students,
      clases: g._count.schedules,
      sesiones_asistencia: g._count.attendanceSessions,
    }))

    return {
      summary: { Cursos: groups.length, "Estudiantes totales": groups.reduce((s, g) => s + g._count.students, 0) },
      columns: [
        { key: "curso", label: "Curso" },
        { key: "nombre", label: "Nombre" },
        { key: "estudiantes", label: "Estudiantes" },
        { key: "clases", label: "Clases" },
        { key: "sesiones_asistencia", label: "Sesiones de asistencia" },
      ],
      rows,
    }
  }

  private async buildFinancialData(tenantId: string, filters: ReportFilters, actor: RequestUser): Promise<ReportTable> {
    const summary = await this.payments.getFinancialSummary(actor, filters)

    const rows = summary.overdueStudents.map((s) => ({
      estudiante: s.studentName,
      curso: s.groupName,
      monto_vencido: s.owed,
      fecha_limite: s.dueDate.toLocaleDateString("es-CO"),
    }))

    return {
      summary: {
        "Total facturado": summary.totalInvoiced,
        "Total recaudado": summary.totalCollected,
        "Total pendiente": summary.totalPending,
        "% de recaudo": `${summary.collectionRate}%`,
        "Facturas en mora": summary.overdueStudents.length,
      },
      columns: [
        { key: "estudiante", label: "Estudiante" },
        { key: "curso", label: "Curso" },
        { key: "monto_vencido", label: "Monto vencido" },
        { key: "fecha_limite", label: "Fecha límite" },
      ],
      rows,
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  async resolveActorForJob(tenantId: string, userId: string): Promise<RequestUser> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenantId },
      select: { id: true, role: true },
    })
    return {
      id: userId,
      email: "",
      tenantId,
      tenantSlug: "",
      membershipId: membership?.id ?? "",
      role: membership?.role ?? UserRole.TENANT_ADMIN,
    }
  }

  async findReportOrThrow(reportId: string, tenantId: string | undefined) {
    const report = await this.prisma.generatedReport.findUnique({ where: { id: reportId } })
    if (!report || report.tenantId !== tenantId) {
      throw new NotFoundException("Reporte no encontrado")
    }
    return report
  }

  private async findScheduleOrThrow(scheduleId: string, tenantId: string | undefined) {
    const schedule = await this.prisma.reportSchedule.findUnique({ where: { id: scheduleId } })
    if (!schedule || schedule.tenantId !== tenantId) {
      throw new NotFoundException("Programación no encontrada")
    }
    return schedule
  }

  private filtersToJson(filters: ReportFilters) {
    return JSON.parse(JSON.stringify(filters))
  }

  private assertTenant(actor: RequestUser): asserts actor is RequestUser & { tenantId: string } {
    if (!actor.tenantId) {
      throw new ForbiddenException("Se requiere un colegio para gestionar reportes")
    }
  }
}
