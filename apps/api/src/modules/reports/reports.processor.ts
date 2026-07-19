import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { Job } from "bullmq"
import { ReportFormat, ReportStatus } from "@prisma/client"
import { PdfRendererService } from "../../core/pdf/pdf-renderer.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { StorageService } from "../../core/storage/storage.service"
import { EmailService } from "../notifications/email/email.service"
import { REPORTS_QUEUE, ReportsService } from "./reports.service"
import { toCsv, toReportHtml } from "./reports.templates"

type GenerateJobData = { reportId: string }
type ScheduledRunJobData = { scheduleId: string; scheduledFor?: string }

@Processor(REPORTS_QUEUE)
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly reports: ReportsService,
    private readonly email: EmailService,
  ) {
    super()
  }

  async process(job: Job<GenerateJobData | ScheduledRunJobData>) {
    if (job.name === "scheduled-run") {
      return this.processScheduledRun(job as Job<ScheduledRunJobData>)
    }
    return this.processGenerate(job as Job<GenerateJobData>)
  }

  private async processGenerate(job: Job<GenerateJobData>) {
    const { reportId } = job.data
    const report = await this.prisma.generatedReport.findUnique({ where: { id: reportId } })
    if (!report) return

    try {
      const { fileKey } = await this.renderAndUpload(report)
      await this.prisma.generatedReport.update({
        where: { id: report.id },
        data: { status: ReportStatus.READY, fileKey, readyAt: new Date() },
      })
    } catch (error) {
      await this.handleFailure(job, report.id, error)
    }
  }

  private async processScheduledRun(job: Job<ScheduledRunJobData>) {
    const { scheduleId, scheduledFor } = job.data
    const schedule = await this.prisma.reportSchedule.findUnique({ where: { id: scheduleId } })
    if (!schedule || !schedule.active) return

    // Programa la siguiente ocurrencia de una vez, anclada a la ocurrencia actual
    // (scheduledFor) para que sea determinista ante reintentos y para que un fallo
    // puntual de esta corrida no rompa la recurrencia. Los jobs del scheduler viejo
    // no traen scheduledFor: en ese caso no se reprograma aquí (reconcile ya creó
    // el job dinámico al arrancar).
    if (scheduledFor) {
      await this.reports.rescheduleAfterRun(scheduleId, new Date(scheduledFor))
    }

    const report = await this.prisma.generatedReport.create({
      data: {
        tenantId: schedule.tenantId,
        type: schedule.type,
        format: schedule.format,
        filters: schedule.filters as object,
        requestedById: schedule.createdById,
      },
    })

    try {
      const { fileKey, downloadUrl } = await this.renderAndUpload(report)
      await this.prisma.generatedReport.update({
        where: { id: report.id },
        data: { status: ReportStatus.READY, fileKey, readyAt: new Date() },
      })

      const label = this.reports.reportLabel(schedule.type)
      let sentCount = 0
      for (const recipient of schedule.recipients) {
        const result = await this.email.send({
          to: recipient,
          subject: `${label} - envío automático`,
          html: `<p>Tu ${label.toLowerCase()} programado ya está listo.</p><p><a href="${downloadUrl}">Descargar reporte</a></p>`,
        })
        if (result.status !== "failed") sentCount += 1
      }

      await this.prisma.reportSchedule.update({
        where: { id: scheduleId },
        data: { totalRuns: { increment: 1 }, emailsSent: { increment: sentCount }, lastRunAt: new Date() },
      })
    } catch (error) {
      await this.handleFailure(job, report.id, error)
    }
  }

  private async renderAndUpload(report: { id: string; tenantId: string; type: string; format: ReportFormat; filters: unknown; requestedById: string }) {
    const actor = await this.reports.resolveActorForJob(report.tenantId, report.requestedById)
    const table = await this.reports.buildData(report.type as never, report.tenantId, (report.filters ?? {}) as never, actor)

    const tenant = await this.prisma.tenant.findUnique({ where: { id: report.tenantId }, select: { name: true } })
    const label = this.reports.reportLabel(report.type as never)

    let buffer: Buffer
    let contentType: string
    let extension: string
    if (report.format === "CSV") {
      buffer = Buffer.from(toCsv(table), "utf-8")
      contentType = "text/csv"
      extension = "csv"
    } else {
      const html = toReportHtml(label, tenant?.name ?? "", new Date(), table)
      buffer = await this.pdfRenderer.renderPdf(html)
      contentType = "application/pdf"
      extension = "pdf"
    }

    const fileKey = `tenants/${report.tenantId}/reports/${report.id}.${extension}`
    await this.storage.upload(fileKey, buffer, contentType)
    const downloadUrl = await this.storage.getSignedDownloadUrl(fileKey)
    return { fileKey, downloadUrl }
  }

  // Mismo patrón que en documents.processor.ts: solo se marca FAILED en el
  // último intento; si a BullMQ le quedan reintentos, se relanza el error.
  private async handleFailure(job: Job, reportId: string, error: unknown) {
    this.logger.error(`Failed to generate report ${reportId}`, error instanceof Error ? error.stack : error)
    const attemptsLeft = (job.opts.attempts ?? 1) - job.attemptsMade > 1
    if (!attemptsLeft) {
      await this.prisma.generatedReport.update({
        where: { id: reportId },
        data: { status: ReportStatus.FAILED, errorMessage: error instanceof Error ? error.message : "Error desconocido" },
      })
    }
    throw error
  }
}
