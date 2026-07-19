import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"
import { AccessScope, AccessSessionStatus, NotificationEventType, UserRole } from "@prisma/client"
import { Request } from "express"
import { AuditService } from "../../core/audit/audit.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { NotificationsService } from "../notifications/notifications.service"
import { RequestUser } from "../../common/types/request-context"
import { BreakGlassInput, DenyAccessInput, RequestAccessInput, RevokeAccessInput } from "./access-control.schemas"

// Mismo criterio que support.controller.ts: quién es "staff" de soporte y quién,
// dentro de ese staff, es supervisor. Un agente puede solicitar acceso; solo un
// supervisor lo aprueba, lo niega o lo revoca a mano.
function isSupportStaff(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SUPPORT_SUPERVISOR || role === UserRole.SUPPORT_AGENT
}

function isSupportSupervisor(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SUPPORT_SUPERVISOR
}

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async requestAccess(input: RequestAccessInput, user: RequestUser, request: Request) {
    if (!isSupportStaff(user.role)) {
      throw new ForbiddenException("Solo el personal de soporte puede solicitar acceso.")
    }

    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: input.ticketId } })
    if (!ticket) throw new NotFoundException("Ticket no encontrado.")
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      throw new ForbiddenException("El ticket ya está cerrado; el acceso solo aplica a tickets activos.")
    }

    const session = await this.prisma.accessSession.create({
      data: {
        ticketId: ticket.id,
        tenantId: ticket.tenantId,
        requestedById: user.id,
        scope: input.scope,
        reason: input.reason,
        requestedDurationMinutes: input.durationMinutes,
        status: AccessSessionStatus.SOLICITADO,
      },
    })

    await this.audit.record({
      tenantId: ticket.tenantId,
      userId: user.id,
      actorRole: user.role,
      action: "support.access.requested",
      entityType: "AccessSession",
      entityId: session.id,
      newValues: { scope: session.scope, reason: session.reason, ticketId: ticket.id },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return session
  }

  async approve(id: string, user: RequestUser, request: Request) {
    if (!isSupportSupervisor(user.role)) {
      throw new ForbiddenException("Solo un supervisor puede aprobar accesos.")
    }

    const session = await this.getSolicitado(id)
    const grantedAt = new Date()
    const expiresAt = new Date(grantedAt.getTime() + session.requestedDurationMinutes * 60_000)

    const updated = await this.prisma.accessSession.update({
      where: { id },
      data: { status: AccessSessionStatus.CONCEDIDO, approvedById: user.id, grantedAt, expiresAt },
    })

    await this.audit.record({
      tenantId: session.tenantId,
      userId: user.id,
      actorRole: user.role,
      action: "support.access.approved",
      entityType: "AccessSession",
      entityId: session.id,
      newValues: { scope: session.scope, expiresAt: expiresAt.toISOString() },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  async deny(id: string, input: DenyAccessInput, user: RequestUser, request: Request) {
    if (!isSupportSupervisor(user.role)) {
      throw new ForbiddenException("Solo un supervisor puede negar accesos.")
    }

    const session = await this.getSolicitado(id)

    const updated = await this.prisma.accessSession.update({
      where: { id },
      data: { status: AccessSessionStatus.REVOCADO, approvedById: user.id, denialReason: input.reason, revokedAt: new Date() },
    })

    await this.audit.record({
      tenantId: session.tenantId,
      userId: user.id,
      actorRole: user.role,
      action: "support.access.denied",
      entityType: "AccessSession",
      entityId: session.id,
      newValues: { reason: input.reason },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  async revoke(id: string, input: RevokeAccessInput, user: RequestUser, request: Request) {
    if (!isSupportSupervisor(user.role)) {
      throw new ForbiddenException("Solo un supervisor puede revocar un acceso.")
    }

    const session = await this.prisma.accessSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException("Sesión de acceso no encontrada.")
    if (session.status !== AccessSessionStatus.CONCEDIDO && session.status !== AccessSessionStatus.EMERGENCIA) {
      throw new ForbiddenException("Solo se puede revocar un acceso activo.")
    }

    const updated = await this.prisma.accessSession.update({
      where: { id },
      data: { status: AccessSessionStatus.REVOCADO, revokedAt: new Date(), revokedReason: input.reason },
    })

    await this.audit.record({
      tenantId: session.tenantId,
      userId: user.id,
      actorRole: user.role,
      action: "support.access.revoked",
      entityType: "AccessSession",
      entityId: session.id,
      newValues: { reason: input.reason },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  // Escucha el mismo evento que ya emite support.service.ts en cada cambio de
  // estado (no se tocó ese módulo para no arriesgar su propia lógica). Evita el
  // caso de "sesión huérfana": un agente con acceso CONCEDIDO cuyo ticket se
  // cierra sin que nadie revoque a mano.
  @OnEvent("support.ticket.updated")
  async onTicketUpdated(ticket: { id: string; status: string }) {
    if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") return
    await this.revokeAllForTicket(ticket.id, `Ticket pasó a estado ${ticket.status}`)
  }

  // Revoca todas las sesiones activas de un ticket. Se llama al cerrar/resolver el
  // ticket (ver support.service.ts). No falla el flujo de cierre si no hay nada que revocar.
  async revokeAllForTicket(ticketId: string, reason: string) {
    const active = await this.prisma.accessSession.findMany({
      where: { ticketId, status: { in: [AccessSessionStatus.CONCEDIDO, AccessSessionStatus.EMERGENCIA] } },
    })
    if (active.length === 0) return

    await this.prisma.accessSession.updateMany({
      where: { id: { in: active.map((s) => s.id) } },
      data: { status: AccessSessionStatus.REVOCADO, revokedAt: new Date(), revokedReason: reason },
    })

    for (const session of active) {
      await this.audit.record({
        tenantId: session.tenantId,
        action: "support.access.revoked",
        entityType: "AccessSession",
        entityId: session.id,
        newValues: { reason },
      })
    }
  }

  // Break-glass: un supervisor se auto-concede acceso inmediato sin flujo de
  // aprobación (nadie más lo aprueba). Se compensa con una ventana corta, un
  // motivo obligatorio más largo y una notificación inmediata al colegio —
  // la auditoría no es opcional aquí, es la única salvaguarda.
  async breakGlass(input: BreakGlassInput, user: RequestUser, request: Request) {
    if (!isSupportSupervisor(user.role)) {
      throw new ForbiddenException("Solo un supervisor puede usar el acceso de emergencia.")
    }

    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: input.ticketId } })
    if (!ticket) throw new NotFoundException("Ticket no encontrado.")

    const grantedAt = new Date()
    const expiresAt = new Date(grantedAt.getTime() + input.durationMinutes * 60_000)

    const session = await this.prisma.accessSession.create({
      data: {
        ticketId: ticket.id,
        tenantId: ticket.tenantId,
        requestedById: user.id,
        approvedById: user.id,
        scope: input.scope,
        reason: input.reason,
        requestedDurationMinutes: input.durationMinutes,
        status: AccessSessionStatus.EMERGENCIA,
        grantedAt,
        expiresAt,
      },
    })

    await this.audit.record({
      tenantId: ticket.tenantId,
      userId: user.id,
      actorRole: user.role,
      action: "support.access.emergency_granted",
      entityType: "AccessSession",
      entityId: session.id,
      newValues: { scope: session.scope, reason: session.reason, expiresAt: expiresAt.toISOString() },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    await this.notifyTenantOfEmergencyAccess(ticket.tenantId, session.id, user, input.reason)

    return session
  }

  private async notifyTenantOfEmergencyAccess(tenantId: string, sessionId: string, actor: RequestUser, reason: string) {
    const recipients = await this.prisma.tenantMembership.findMany({
      where: { tenantId, status: "ACTIVE", role: { in: [UserRole.TENANT_ADMIN, UserRole.PRINCIPAL] } },
      select: { userId: true },
    })
    if (recipients.length === 0) return

    await this.notifications.notify({
      tenantId,
      eventType: NotificationEventType.SUPPORT_ACCESS_EMERGENCY,
      recipientUserIds: recipients.map((r) => r.userId),
      title: "Acceso de emergencia de soporte",
      body: `${actor.email} usó acceso de emergencia a datos de tu colegio. Motivo: ${reason}`,
      entityType: "AccessSession",
      entityId: sessionId,
    })
  }

  // Sesión activa del usuario actual en su tenant actual (para el banner persistente
  // y para que DataScopeGuard sepa si dejar pasar un request). Se filtra por el
  // ticketId embebido en el JWT, no solo por (agente, colegio): así el banner
  // siempre refleja la sesión que realmente está aplicando DataScopeGuard para
  // ESTE JWT, aunque el agente tenga otra sesión activa por otro ticket. Resuelve
  // la expiración de forma perezosa: si CONCEDIDO/EMERGENCIA ya venció, la marca
  // EXPIRADO al leerla en vez de depender de un job en segundo plano.
  async getActiveForCurrentUser(user: RequestUser) {
    if (!user.isImpersonated || !user.ticketId) return null

    const session = await this.prisma.accessSession.findFirst({
      where: {
        requestedById: user.id,
        ticketId: user.ticketId,
        tenantId: user.tenantId,
        status: { in: [AccessSessionStatus.CONCEDIDO, AccessSessionStatus.EMERGENCIA] },
      },
      orderBy: { grantedAt: "desc" },
    })
    if (!session) return null

    return this.resolveExpiration(session)
  }

  async listForTicket(ticketId: string, user: RequestUser) {
    if (!isSupportStaff(user.role)) {
      throw new ForbiddenException("Solo el personal de soporte puede ver el historial de accesos.")
    }
    const sessions = await this.prisma.accessSession.findMany({
      where: { ticketId },
      orderBy: { requestedAt: "desc" },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    return Promise.all(sessions.map((s) => this.resolveExpiration(s)))
  }

  // Usado por auth.service#impersonate para decidir si emitir el JWT de
  // impersonación. Aislado por ticket a propósito: dos sesiones activas del
  // mismo agente sobre el mismo colegio (una por ticket) no se mezclan — cada
  // una solo habilita entrar citando SU ticket. DATOS_PERSONALES cubre también
  // endpoints OPERATIVO; OPERATIVO no cubre DATOS_PERSONALES.
  async hasActiveScopeForTicket(
    userId: string,
    ticketId: string,
    tenantId: string,
    requiredScope: AccessScope,
  ): Promise<boolean> {
    const session = await this.prisma.accessSession.findFirst({
      where: {
        requestedById: userId,
        ticketId,
        tenantId,
        status: { in: [AccessSessionStatus.CONCEDIDO, AccessSessionStatus.EMERGENCIA] },
        expiresAt: { gt: new Date() },
        ...(requiredScope === AccessScope.DATOS_PERSONALES ? { scope: AccessScope.DATOS_PERSONALES } : {}),
      },
      select: { id: true },
    })
    return session !== null
  }

  private async getSolicitado(id: string) {
    const session = await this.prisma.accessSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException("Sesión de acceso no encontrada.")
    if (session.status !== AccessSessionStatus.SOLICITADO) {
      throw new ForbiddenException("Esta solicitud ya fue resuelta.")
    }
    return session
  }

  // Genérico para no perder relaciones incluidas (requestedBy/approvedBy en
  // listForTicket): en vez de reemplazar el objeto con el resultado plano del
  // update, solo se sobreescribe el status sobre el objeto original.
  private async resolveExpiration<T extends { id: string; status: AccessSessionStatus; expiresAt: Date | null }>(
    session: T,
  ): Promise<T> {
    const isExpired =
      (session.status === AccessSessionStatus.CONCEDIDO || session.status === AccessSessionStatus.EMERGENCIA) &&
      session.expiresAt !== null &&
      session.expiresAt.getTime() <= Date.now()

    if (!isExpired) return session

    await this.prisma.accessSession.update({
      where: { id: session.id },
      data: { status: AccessSessionStatus.EXPIRADO },
    })

    return { ...session, status: AccessSessionStatus.EXPIRADO }
  }
}
