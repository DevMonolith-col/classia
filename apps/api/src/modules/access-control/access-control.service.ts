import { InjectQueue } from "@nestjs/bullmq"
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter"
import { AccessScope, AccessSessionStatus, NotificationEventType, Prisma, UserRole } from "@prisma/client"
import { Queue } from "bullmq"
import { Request } from "express"
import { AuditService } from "../../core/audit/audit.service"
import { buildJobId } from "../../core/queue/job-id"
import { PrismaService } from "../../core/prisma/prisma.service"
import { NotificationsService } from "../notifications/notifications.service"
import { RequestUser } from "../../common/types/request-context"
import {
  ApproveAccessInput,
  BreakGlassInput,
  DenyAccessInput,
  MAX_ACCESS_DURATION_MINUTES,
  RequestAccessInput,
  RevokeAccessInput,
} from "./access-control.schemas"

export const ACCESS_SESSION_EXPIRY_QUEUE = "access-session-expiry"
// Cada minuto: las duraciones mínimas son de 15 min, así que un margen de
// hasta 1 min entre que algo vence y el barrido lo marca es despreciable
// frente a eso, sin generar carga de más. Sigue siendo la red de seguridad —
// el job diferido por sesión (scheduleExpiryJob) es quien dispara justo a
// tiempo; el barrido atrapa lo que ese job se pierda (caída del proceso entre
// que se programó y que debía dispararse, reinicio de Redis, etc.).
export const EXPIRY_SWEEP_INTERVAL_MS = 60_000

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
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(ACCESS_SESSION_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
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

  async approve(id: string, input: ApproveAccessInput, user: RequestUser, request: Request) {
    if (!isSupportSupervisor(user.role)) {
      throw new ForbiddenException("Solo un supervisor puede aprobar accesos.")
    }

    const session = await this.getSolicitado(id)

    // El aprobador puede ajustar la duración; si no la manda, se respeta la
    // solicitada. El techo efectivo es el del colegio si lo configuró, si no
    // el absoluto del sistema — nunca al revés (un colegio no puede fijar un
    // techo por encima del absoluto; eso ya lo valida updateTenantSchema al
    // guardarlo). Esto RECHAZA en vez de recortar en silencio: si el
    // supervisor pide una duración por encima del techo, se entera con un 400
    // en vez de recibir una ventana más corta sin avisar.
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: session.tenantId },
      select: { maxAccessDurationMinutes: true },
    })
    const effectiveCap = tenant.maxAccessDurationMinutes ?? MAX_ACCESS_DURATION_MINUTES
    const grantedDurationMinutes = input.durationMinutes ?? session.requestedDurationMinutes

    if (grantedDurationMinutes > effectiveCap) {
      throw new BadRequestException(
        `La duración concedida no puede exceder el techo de este colegio (${effectiveCap} minutos).`,
      )
    }

    const grantedAt = new Date()
    const expiresAt = new Date(grantedAt.getTime() + grantedDurationMinutes * 60_000)

    const updated = await this.prisma.accessSession.update({
      where: { id },
      data: { status: AccessSessionStatus.CONCEDIDO, approvedById: user.id, grantedAt, expiresAt },
    })

    // Job diferido puntual además del barrido periódico — dispara justo cuando
    // vence en vez de tolerar hasta EXPIRY_SWEEP_INTERVAL_MS de desfase.
    await this.scheduleExpiryJob(updated.id, expiresAt)

    await this.audit.record({
      tenantId: session.tenantId,
      userId: user.id,
      actorRole: user.role,
      action: "support.access.approved",
      entityType: "AccessSession",
      entityId: session.id,
      newValues: {
        scope: session.scope,
        expiresAt: expiresAt.toISOString(),
        requestedDurationMinutes: session.requestedDurationMinutes,
        grantedDurationMinutes,
      },
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

  // deny() opera sobre SOLICITADO -> REVOCADO y no tiene otro escritor
  // concurrente posible (nada más transiciona una solicitud sin resolver), así
  // que no pasa por transitionAccessSession — ese guard existe para las
  // transiciones CONCEDIDO/EMERGENCIA -> terminal, donde sí compiten el
  // barrido, el job diferido, la resolución perezosa y las revocaciones.
  async revoke(id: string, input: RevokeAccessInput, user: RequestUser, request: Request) {
    if (!isSupportSupervisor(user.role)) {
      throw new ForbiddenException("Solo un supervisor puede revocar un acceso.")
    }

    const session = await this.prisma.accessSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException("Sesión de acceso no encontrada.")
    if (session.status !== AccessSessionStatus.CONCEDIDO && session.status !== AccessSessionStatus.EMERGENCIA) {
      throw new ForbiddenException("Solo se puede revocar un acceso activo.")
    }

    const won = await this.transitionAccessSession(session, {
      status: AccessSessionStatus.REVOCADO,
      revokedAt: new Date(),
      revokedReason: input.reason,
    })
    if (!won) {
      // Alguien más (el barrido, el job diferido de esta misma sesión, o la
      // resolución perezosa de otro request) ganó la transición entre que se
      // leyó esta fila y este intento — la sesión ya no está activa.
      throw new ConflictException("Esta sesión ya no está activa; probablemente expiró justo ahora.")
    }

    await this.cancelExpiryJob(session.id)

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

    return this.prisma.accessSession.findUniqueOrThrow({ where: { id } })
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

    for (const session of active) {
      const won = await this.transitionAccessSession(session, {
        status: AccessSessionStatus.REVOCADO,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      if (!won) continue

      await this.cancelExpiryJob(session.id)

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

    await this.scheduleExpiryJob(session.id, expiresAt)

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
  // EXPIRADO al leerla en vez de depender solo del job en segundo plano.
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

  // Único punto de escritura del status de una AccessSession activa
  // (CONCEDIDO/EMERGENCIA -> lo que sea). Compare-and-swap: el WHERE incluye
  // el status que se leyó, así que si otra ruta ya transicionó la fila entre
  // la lectura y este intento, count da 0 y el caller sabe que perdió la
  // carrera en vez de pisar un estado que ya no es el que creía. Consumida por
  // expireSessionById, revokeAllForTicket, resolveExpiration y revoke() — es
  // la única escritura directa de `status` fuera de requestAccess/approve/deny
  // (que parten de SOLICITADO, sin escritores concurrentes posibles).
  private async transitionAccessSession(
    session: { id: string; status: AccessSessionStatus },
    data: Prisma.AccessSessionUpdateInput,
  ): Promise<boolean> {
    const { count } = await this.prisma.accessSession.updateMany({
      where: { id: session.id, status: session.status },
      data,
    })
    return count === 1
  }

  // Genérico para no perder relaciones incluidas (requestedBy/approvedBy en
  // listForTicket): en vez de reemplazar el objeto con el resultado plano del
  // update, solo se sobreescribe el status sobre el objeto original.
  //
  // Red de seguridad además del barrido y del job diferido por sesión, no un
  // reemplazo de ninguno de los dos: si se lee esta fila antes de que
  // cualquiera de ellos la alcance, esto la marca EXPIRADO al vuelo para que
  // un GET no muestre una sesión vencida como si siguiera activa.
  private async resolveExpiration<T extends { id: string; status: AccessSessionStatus; expiresAt: Date | null }>(
    session: T,
  ): Promise<T> {
    const isExpired =
      (session.status === AccessSessionStatus.CONCEDIDO || session.status === AccessSessionStatus.EMERGENCIA) &&
      session.expiresAt !== null &&
      session.expiresAt.getTime() <= Date.now()

    if (!isExpired) return session

    const won = await this.expireSessionById(session.id)
    if (won) return { ...session, status: AccessSessionStatus.EXPIRADO }

    // Perdió la carrera contra el barrido, el job diferido o una revocación —
    // se relee el estado real en vez de asumir EXPIRADO a ciegas (podría estar
    // REVOCADO).
    const fresh = await this.prisma.accessSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { status: true },
    })
    return { ...session, status: fresh.status }
  }

  // Único punto que expira una AccessSession con TODOS sus efectos:
  // transición CONCEDIDO/EMERGENCIA -> EXPIRADO (compare-and-swap vía
  // transitionAccessSession), revocación de las AuthSession de impersonación
  // asociadas, auditoría "support.access.expired" y notificación en tiempo
  // real al room del ticket. Lo llaman el barrido periódico
  // (expireOverdueSessions), el job diferido por sesión y resolveExpiration()
  // — cualquiera que gane la transición hace todo el trabajo una sola vez; los
  // demás ven `false` y no hacen nada más. Así una sesión nunca produce más de
  // un "support.access.expired" ni revoca sus AuthSession dos veces, sin
  // importar cuál de los tres caminos llegue primero.
  async expireSessionById(id: string): Promise<boolean> {
    const session = await this.prisma.accessSession.findUnique({
      where: { id },
      select: { id: true, status: true, tenantId: true, ticketId: true, requestedById: true, scope: true, expiresAt: true },
    })
    if (!session) return false
    if (session.status !== AccessSessionStatus.CONCEDIDO && session.status !== AccessSessionStatus.EMERGENCIA) return false
    // Defensivo: el job diferido está programado para disparar justo a
    // tiempo, pero si por lo que sea corre antes (reloj del worker adelantado,
    // reintento inmediato de BullMQ), no expira una sesión que todavía es válida.
    if (!session.expiresAt || session.expiresAt.getTime() > Date.now()) return false

    const won = await this.transitionAccessSession(session, { status: AccessSessionStatus.EXPIRADO })
    if (!won) return false

    // Si fue el barrido (o la resolución perezosa) quien ganó la transición
    // — no el propio job diferido de esta sesión — el job diferido original
    // sigue pendiente en Redis apuntando a una sesión que ya no existe como
    // CONCEDIDO/EMERGENCIA. No es un problema de corrección (expireSessionById
    // es un no-op seguro si llega a disparar igual), pero lo cancela para no
    // dejar basura acumulándose en la cola. Si SÍ fue el job diferido quien
    // ganó, esto es un no-op (BullMQ ya lo retira solo por removeOnComplete).
    await this.cancelExpiryJob(session.id)

    const revoked = await this.prisma.authSession.updateMany({
      where: {
        ticketId: session.ticketId,
        userId: session.requestedById,
        isImpersonated: true,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })

    // Distinto de "support.access.revoked" (revocación manual o por cierre de
    // ticket) a propósito: esto lo disparó el paso del tiempo, no una decisión
    // de una persona.
    await this.audit.record({
      tenantId: session.tenantId,
      userId: session.requestedById,
      action: "support.access.expired",
      entityType: "AccessSession",
      entityId: session.id,
      newValues: { scope: session.scope, ticketId: session.ticketId, authSessionsRevoked: revoked.count },
    })

    // Tiempo real: SupportGateway reenvía esto al room `ticket:${ticketId}`
    // (el mismo que ya existe para el chat, sin ampliar el modelo de rooms)
    // para que el banner de quien está impersonando reaccione sin esperar a
    // su próximo request.
    this.eventEmitter.emit("support.access.expired", {
      ticketId: session.ticketId,
      accessSessionId: session.id,
      scope: session.scope,
    })

    return true
  }

  // Barrido proactivo (llamado por AccessSessionExpiryProcessor cada
  // EXPIRY_SWEEP_INTERVAL_MS): red de seguridad para toda AccessSession
  // CONCEDIDO/EMERGENCIA vencida cuyo job diferido no disparó (proceso caído
  // entre que se programó y que debía dispararse, Redis reiniciado sin
  // persistir, etc.). Cada candidata se procesa vía expireSessionById(), que
  // ya es idempotente por diseño.
  async expireOverdueSessions(): Promise<{ expiredSessions: number }> {
    const candidates = await this.prisma.accessSession.findMany({
      where: {
        status: { in: [AccessSessionStatus.CONCEDIDO, AccessSessionStatus.EMERGENCIA] },
        expiresAt: { lte: new Date() },
      },
      select: { id: true },
    })

    let expiredSessions = 0
    for (const candidate of candidates) {
      if (await this.expireSessionById(candidate.id)) expiredSessions++
    }

    return { expiredSessions }
  }

  private expiryJobId(accessSessionId: string) {
    // Ver core/queue/job-id.ts: BullMQ rechaza ":" en un jobId personalizado.
    // reports.service.ts#schedulerJobId tenía el mismo bug — ya corregido, ver
    // ese archivo — y ambos ahora pasan por el mismo helper.
    return buildJobId("access-session-expire", accessSessionId)
  }

  // Job diferido puntual, programado al conceder (approve/breakGlass) con
  // delay = la ventana real de la sesión. jobId estable por sesión: un
  // approve() nunca re-programa la misma sesión dos veces (cada sesión solo
  // se concede una vez), pero el jobId estable de todas formas dobla como
  // protección barata si algo llegara a llamarlo dos veces.
  private async scheduleExpiryJob(accessSessionId: string, expiresAt: Date) {
    const delay = Math.max(0, expiresAt.getTime() - Date.now())
    await this.expiryQueue.add(
      "expire-one",
      { accessSessionId },
      { jobId: this.expiryJobId(accessSessionId), delay, removeOnComplete: true, removeOnFail: true },
    )
  }

  // Se llama desde toda transición terminal previa al vencimiento (revoke,
  // revokeAllForTicket) para no dejar un job diferido "vivo" en Redis
  // apuntando a una sesión que ya no está CONCEDIDO/EMERGENCIA. No es
  // estrictamente necesario para la corrección (expireSessionById es un no-op
  // seguro si la sesión ya no está activa cuando el job dispara), pero evita
  // acumular jobs diferidos muertos en la cola indefinidamente.
  private async cancelExpiryJob(accessSessionId: string) {
    await this.expiryQueue.remove(this.expiryJobId(accessSessionId)).catch(() => {})
  }
}
