import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger, OnModuleDestroy } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Job } from "bullmq"
import puppeteer, { Browser } from "puppeteer"
import QRCode from "qrcode"
import { DocumentStatus, DocumentType } from "@prisma/client"
import { PrismaService } from "../../core/prisma/prisma.service"
import { StorageService } from "../../core/storage/storage.service"
import { DocumentsService, DOCUMENTS_QUEUE } from "./documents.service"
import { renderTemplate } from "./documents.templates"

// Generar el PDF (Puppeteer) bloquea CPU y consume ~100-300MB por render.
// Hacerlo dentro del request de la secretaría tumbaría la API entera para
// todos los colegios si varios certificados se piden a la vez (fin de mes,
// varios padres descargando boletines). Por eso corre acá, en un worker
// separado de BullMQ: el endpoint solo encola y responde de inmediato con
// PENDING; este processor genera en segundo plano y el cliente hace poll
// (o recibe el aviso por socket) hasta ver READY.
@Processor(DOCUMENTS_QUEUE)
export class DocumentsProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentsProcessor.name)
  private browserPromise: Promise<Browser> | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documents: DocumentsService,
    private readonly config: ConfigService,
  ) {
    super()
  }

  async process(job: Job<{ issuanceId: string }>) {
    const { issuanceId } = job.data

    const issuance = await this.prisma.documentIssuance.findUnique({
      where: { id: issuanceId },
      include: {
        student: { include: { tenant: true, group: true } },
        reportCard: true,
      },
    })
    if (!issuance) return

    try {
      const template = await this.documents.getOrCreateTemplate(issuance.tenantId, issuance.type)
      const webUrl = this.config.get<string>("app.webUrl") ?? "http://localhost:3000"
      const verifyUrl = `${webUrl}/verify/${issuance.verificationCode}`
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 })

      const vars: Record<string, string> = {
        studentName: `${issuance.student.firstName} ${issuance.student.lastName}`,
        studentDocument: issuance.student.documentId ?? "N/A",
        groupName: issuance.student.group ? `${issuance.student.group.grade}${issuance.student.group.section}` : "N/A",
        tenantName: issuance.student.tenant.name,
        issuedDate: new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }),
        verificationCode: issuance.verificationCode,
        verifyUrl,
        qrDataUrl,
      }
      if (issuance.type === DocumentType.REPORT_CARD && issuance.reportCard) {
        vars.overallAverage = issuance.reportCard.overallAverage.toFixed(1)
        vars.scaleName = issuance.reportCard.scaleName
      }

      const html = renderTemplate(template.contentHtml, vars)
      const pdfBuffer = await this.renderPdf(html)

      const key = `tenants/${issuance.tenantId}/documents/${issuance.id}.pdf`
      await this.storage.upload(key, pdfBuffer, "application/pdf")

      await this.prisma.documentIssuance.update({
        where: { id: issuance.id },
        data: { status: DocumentStatus.READY, pdfKey: key, readyAt: new Date() },
      })
    } catch (error) {
      this.logger.error(`Failed to generate document ${issuanceId}`, error instanceof Error ? error.stack : error)
      const attemptsLeft = (job.opts.attempts ?? 1) - job.attemptsMade > 1
      // Si a BullMQ le quedan reintentos, no marcamos FAILED todavía - dejamos
      // el issuance en PENDING (el usuario sigue viendo "Generando...") y
      // relanzamos para que el backoff exponencial haga su trabajo. Recién en
      // el último intento persistimos el error real para mostrarlo en la UI.
      if (!attemptsLeft) {
        await this.prisma.documentIssuance.update({
          where: { id: issuance.id },
          data: { status: DocumentStatus.FAILED, errorMessage: error instanceof Error ? error.message : "Error desconocido" },
        })
      }
      throw error
    }
  }

  private async renderPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    try {
      // Las plantillas las edita personal de confianza del tenant (no son
      // input público), pero igual no hay ningún caso de uso legítimo para
      // JS en un certificado estático - desactivarlo cierra de raíz que una
      // plantilla (por error o mala intención) intente hacer fetch/XHR
      // saliente desde el proceso del servidor.
      await page.setJavaScriptEnabled(false)
      // Timeout explícito: una plantilla con CSS roto o una imagen externa
      // que nunca resuelve no debe poder colgar el worker para siempre (con
      // un solo browser reusado entre jobs, un job colgado indefinidamente
      // deja de ser "solo ese certificado" y empieza a acumular páginas
      // abiertas sin cerrar).
      await page.setContent(html, { waitUntil: "load", timeout: 15_000 })
      const pdf = await page.pdf({ format: "letter", printBackground: true, timeout: 15_000 })
      return Buffer.from(pdf)
    } finally {
      await page.close()
    }
  }

  // Un solo Chromium reusado entre jobs en vez de lanzar uno nuevo por PDF -
  // lanzar el navegador es lo más caro de toda la operación (~1-2s y bastante
  // RAM); reusarlo es la diferencia entre esto siendo viable o no bajo carga.
  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] })
    }
    return this.browserPromise
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise
      await browser.close()
    }
  }
}
