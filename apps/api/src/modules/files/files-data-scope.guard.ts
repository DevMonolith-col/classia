import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { AccessScope, AccessSessionStatus } from "@prisma/client"
import { Request } from "express"
import { AuditService } from "../../core/audit/audit.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { RequestUser } from "../../common/types/request-context"

// `files` sirve cualquier fileKey por una única ruta genérica; la sensibilidad
// real depende de qué ENTIDAD es dueña de esa clave, no de la ruta. Tabla de
// resolución (categoría de archivo -> entidad dueña -> alcance):
//
//   Homework.attachmentKey          -> material de curso                  -> OPERATIVO
//   Question.imageKey               -> material de curso (quiz)           -> OPERATIVO
//   SupportTicket.attachmentKey     -> adjunto de ticket de soporte        -> OPERATIVO
//   TicketComment.attachmentKey     -> adjunto de comentario de ticket     -> OPERATIVO
//   HomeworkSubmission.attachmentKey-> entrega de UN estudiante            -> DATOS_PERSONALES
//   ConversationMessage.attachmentKey -> adjunto de mensaje privado        -> DATOS_PERSONALES
//   DocumentIssuance.pdfKey         -> certificado con datos de un alumno  -> DATOS_PERSONALES
//   GeneratedReport.fileKey         -> depende de GeneratedReport.type:
//                                        COURSES -> OPERATIVO, el resto -> DATOS_PERSONALES
//   (ninguna de las anteriores)     -> clave huérfana o recién subida,
//                                       sin adjuntar todavía              -> DATOS_PERSONALES (fallback)
//
// Ninguna categoría CONOCIDA es ambigua una vez resuelta — el único caso no
// concluyente es "no aparece en ninguna tabla", que cae al fallback
// conservador. subir un archivo nuevo (`upload`, sin key todavía) también usa
// el fallback: no hay nada que resolver todavía, y no se audita (no es una
// clave que "debería" haber resuelto y no pudo — simplemente no existe aún).
//
// Cada caída al fallback CON key presente (sí existía una clave, pero no
// coincidió con ninguna tabla dueña conocida) se audita con "files.scope_fallback"
// — instrumentación pedida para medir con datos reales qué tan seguido pasa
// esto antes de decidir si amerita resolución exhaustiva (p. ej. un registro
// explícito fileKey -> entidad al subir, en vez de esta búsqueda por tablas).
// El comportamiento del fallback en sí (DATOS_PERSONALES) no cambia.
const OPERATIVO_REPORT_TYPES = new Set(["COURSES"])

@Injectable()
export class FilesDataScopeGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const user = request.user as RequestUser | undefined
    if (!user || !user.isImpersonated) return true

    // Aislado por ticket, igual que DataScopeGuard — ver ese archivo para el
    // razonamiento completo.
    if (!user.ticketId) {
      throw new ForbiddenException("Esta sesión de impersonación no tiene un ticket asociado; vuelve a entrar desde el ticket.")
    }

    const key = (request.query as { key?: string } | undefined)?.key
    const requiredScope = key ? await this.resolveScope(key, user) : AccessScope.DATOS_PERSONALES

    const activeSession = await this.prisma.accessSession.findFirst({
      where: {
        requestedById: user.id,
        ticketId: user.ticketId,
        tenantId: user.tenantId,
        status: { in: [AccessSessionStatus.CONCEDIDO, AccessSessionStatus.EMERGENCIA] },
        expiresAt: { gt: new Date() },
        ...(requiredScope === AccessScope.DATOS_PERSONALES ? { scope: AccessScope.DATOS_PERSONALES } : {}),
      },
      select: { id: true },
    })

    if (!activeSession) {
      throw new ForbiddenException(
        requiredScope === AccessScope.DATOS_PERSONALES
          ? "Este archivo requiere una sesión de acceso con alcance de datos personales aprobada por el colegio para este ticket."
          : "Este archivo requiere una sesión de acceso aprobada por el colegio para este ticket.",
      )
    }

    return true
  }

  private async resolveScope(key: string, user: RequestUser): Promise<AccessScope> {
    const [homework, question, ticket, ticketComment, submission, message, document, report] = await Promise.all([
      this.prisma.homework.findFirst({ where: { attachmentKey: key }, select: { id: true } }),
      this.prisma.question.findFirst({ where: { imageKey: key }, select: { id: true } }),
      this.prisma.supportTicket.findFirst({ where: { attachmentKey: key }, select: { id: true } }),
      this.prisma.ticketComment.findFirst({ where: { attachmentKey: key }, select: { id: true } }),
      this.prisma.homeworkSubmission.findFirst({ where: { attachmentKey: key }, select: { id: true } }),
      this.prisma.conversationMessage.findFirst({ where: { attachmentKey: key }, select: { id: true } }),
      this.prisma.documentIssuance.findFirst({ where: { pdfKey: key }, select: { id: true } }),
      this.prisma.generatedReport.findFirst({ where: { fileKey: key }, select: { type: true } }),
    ])

    if (homework || question || ticket || ticketComment) return AccessScope.OPERATIVO
    if (submission || message || document) return AccessScope.DATOS_PERSONALES
    if (report) return OPERATIVO_REPORT_TYPES.has(report.type) ? AccessScope.OPERATIVO : AccessScope.DATOS_PERSONALES

    // Clave no encontrada en ninguna tabla dueña: no concluyente, fallback
    // conservador — instrumentado para dimensionar la brecha con datos reales.
    await this.audit.record({
      tenantId: user.tenantId,
      userId: user.id,
      actorRole: user.role,
      action: "files.scope_fallback",
      entityType: "File",
      entityId: key,
      newValues: { ticketId: user.ticketId },
    })

    return AccessScope.DATOS_PERSONALES
  }
}
