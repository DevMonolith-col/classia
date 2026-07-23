import { randomBytes } from "node:crypto"
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { DocumentType } from "@prisma/client"
import { RequestUser } from "../../common/types/request-context"
import { PrismaService } from "../../core/prisma/prisma.service"
import { StorageService } from "../../core/storage/storage.service"
import QRCode from "qrcode"
import { DEFAULT_TEMPLATE_HTML, DEFAULT_TEMPLATE_NAMES, buildSampleVars, renderTemplate } from "./documents.templates"
import { IssueDocumentInput, UpdateTemplateInput } from "./documents.schemas"

export const DOCUMENTS_QUEUE = "documents"

// Puppeteer puede fallar por razones transitorias (el navegador compartido
// se reinicia, un pico de memoria momentáneo) que un reintento automático
// resuelve solo, sin que la secretaría tenga que darse cuenta y reintentar
// a mano. Backoff exponencial para no reintentar 3 veces en el mismo segundo
// si el problema es de fondo (ej. Chromium realmente caído).
const GENERATE_JOB_OPTIONS = { attempts: 3, backoff: { type: "exponential" as const, delay: 5_000 } }

function generateVerificationCode(): string {
  // Base32-ish, sin caracteres ambiguos (0/O, 1/I) - va impreso en el PDF.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 8 }, () => alphabet[randomBytes(1)[0] % alphabet.length]).join("")
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(DOCUMENTS_QUEUE) private readonly queue: Queue,
  ) {}

  async issue(actor: RequestUser, data: IssueDocumentInput) {
    if (!actor.tenantId) throw new ForbiddenException("Se requiere un colegio para emitir documentos")

    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId: actor.tenantId },
      select: { id: true },
    })
    if (!student) throw new BadRequestException("El estudiante no pertenece a este colegio")

    if (data.type === DocumentType.REPORT_CARD) {
      if (!data.reportCardId) throw new BadRequestException("Falta el boletín a certificar")
      const reportCard = await this.prisma.reportCard.findFirst({
        where: { id: data.reportCardId, studentId: data.studentId, tenantId: actor.tenantId },
        select: { id: true },
      })
      if (!reportCard) throw new BadRequestException("El boletín no pertenece a este estudiante")
    }

    let verificationCode = generateVerificationCode()
    // Colisión de 8 caracteres en un alfabeto de 32 es astronómicamente
    // improbable, pero como el campo es @unique, reintentar es gratis y
    // evita que una carrera rarísima tumbe la emisión con un 500.
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await this.prisma.documentIssuance.findUnique({ where: { verificationCode }, select: { id: true } })
      if (!exists) break
      verificationCode = generateVerificationCode()
    }

    const issuance = await this.prisma.documentIssuance.create({
      data: {
        tenantId: actor.tenantId,
        studentId: data.studentId,
        reportCardId: data.reportCardId,
        type: data.type,
        verificationCode,
        issuedById: actor.id,
      },
    })

    await this.queue.add("generate", { issuanceId: issuance.id, tenantId: actor.tenantId }, GENERATE_JOB_OPTIONS)

    return issuance
  }

  async getStatus(issuanceId: string, actor: RequestUser) {
    const issuance = await this.findIssuanceOrThrow(issuanceId, actor)
    const downloadUrl = issuance.pdfKey ? await this.storage.getSignedDownloadUrl(issuance.pdfKey) : null
    return { ...issuance, downloadUrl }
  }

  async listForTenant(actor: RequestUser) {
    if (!actor.tenantId) throw new ForbiddenException("Se requiere un colegio")
    return this.prisma.documentIssuance.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { issuedAt: "desc" },
      take: 300,
      include: { student: { select: { firstName: true, lastName: true } } },
    })
  }

  async listMine(actor: RequestUser) {
    const studentIds = await this.resolveOwnedStudentIds(actor)
    if (studentIds.length === 0) return []

    const issuances = await this.prisma.documentIssuance.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { issuedAt: "desc" },
      include: { student: { select: { firstName: true, lastName: true } } },
    })

    return Promise.all(
      issuances.map(async (i) => ({
        ...i,
        downloadUrl: i.status === "READY" && i.pdfKey ? await this.storage.getSignedDownloadUrl(i.pdfKey) : null,
      })),
    )
  }

  async retry(issuanceId: string, actor: RequestUser) {
    const issuance = await this.findIssuanceOrThrow(issuanceId, actor)
    if (issuance.status !== "FAILED") {
      throw new BadRequestException("Solo se pueden reintentar documentos que fallaron")
    }
    const updated = await this.prisma.documentIssuance.update({
      where: { id: issuanceId },
      data: { status: "PENDING", errorMessage: null },
    })
    await this.queue.add("generate", { issuanceId: updated.id, tenantId: actor.tenantId }, GENERATE_JOB_OPTIONS)
    return updated
  }

  async revoke(issuanceId: string, actor: RequestUser) {
    const issuance = await this.findIssuanceOrThrow(issuanceId, actor)
    if (issuance.revokedAt) return issuance
    return this.prisma.documentIssuance.update({ where: { id: issuanceId }, data: { revokedAt: new Date() } })
  }

  // Endpoint público: sin actor, sin tenant. No exponer nada que no vaya ya
  // impreso en el propio documento.
  async verify(code: string) {
    const issuance = await this.prisma.documentIssuance.findUnique({
      where: { verificationCode: code },
      include: { tenant: { select: { name: true } }, student: { select: { firstName: true, lastName: true } } },
    })
    if (!issuance || issuance.status !== "READY") {
      return { valid: false as const }
    }
    return {
      valid: !issuance.revokedAt,
      revoked: Boolean(issuance.revokedAt),
      type: issuance.type,
      issuedAt: issuance.issuedAt,
      studentName: `${issuance.student.firstName} ${issuance.student.lastName}`,
      tenantName: issuance.tenant.name,
    }
  }

  // ─── Plantillas ──────────────────────────────────────────────────────────────

  async getTemplate(actor: RequestUser, type: DocumentType) {
    if (!actor.tenantId) throw new ForbiddenException("Se requiere un colegio")
    return this.getOrCreateTemplate(actor.tenantId, type)
  }

  async updateTemplate(actor: RequestUser, type: DocumentType, data: UpdateTemplateInput) {
    if (!actor.tenantId) throw new ForbiddenException("Se requiere un colegio")
    await this.getOrCreateTemplate(actor.tenantId, type) // asegura que exista la fila a actualizar
    return this.prisma.documentTemplate.update({
      where: { tenantId_type: { tenantId: actor.tenantId, type } },
      data: { name: data.name, contentHtml: data.contentHtml },
    })
  }

  // Vista previa del editor: renderiza el HTML tal cual está en el textarea
  // (aún no guardado) con datos ficticios, sin tocar la BD ni pasar por
  // Puppeteer - el editor necesita feedback instantáneo, no un PDF real.
  async previewTemplate(type: DocumentType, contentHtml: string) {
    const qrDataUrl = await QRCode.toDataURL("https://classia.co/verify/AB12CD34", { margin: 1, width: 180 })
    return { html: renderTemplate(contentHtml, buildSampleVars(type, qrDataUrl)) }
  }

  async getOrCreateTemplate(tenantId: string, type: DocumentType) {
    const existing = await this.prisma.documentTemplate.findUnique({ where: { tenantId_type: { tenantId, type } } })
    if (existing) return existing
    return this.prisma.documentTemplate.create({
      data: { tenantId, type, name: DEFAULT_TEMPLATE_NAMES[type], contentHtml: DEFAULT_TEMPLATE_HTML[type] },
    })
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findIssuanceOrThrow(issuanceId: string, actor: RequestUser) {
    const issuance = await this.prisma.documentIssuance.findUnique({ where: { id: issuanceId } })
    if (!issuance || issuance.tenantId !== actor.tenantId) {
      throw new NotFoundException("Documento no encontrado")
    }
    return issuance
  }

  private async resolveOwnedStudentIds(actor: RequestUser): Promise<string[]> {
    const student = await this.prisma.student.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    })
    if (student) return [student.id]

    const guardian = await this.prisma.guardian.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { students: { select: { studentId: true } } },
    })
    return guardian?.students.map((s) => s.studentId) ?? []
  }
}
