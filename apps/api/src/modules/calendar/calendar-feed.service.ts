import { createHash, randomBytes } from "node:crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { Request } from "express";
import QRCode from "qrcode";
import { AudienceScopeService } from "../../common/audience/audience-scope.service";
import { resolveTenantTimezone } from "../../common/time/tenant-timezone";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PlatformAdminPrismaService } from "../../core/prisma/platform-admin-prisma.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import { EventsService } from "../events/events.service";
import { buildIcsCalendar, type IcsItem } from "./ics";

// Ventana del feed. Hacia atrás lo justo para que un cliente que se suscribe hoy vea el
// contexto reciente; hacia adelante un año, que es lo que dura un calendario escolar.
const FEED_DAYS_BACK = 90;
const FEED_DAYS_FORWARD = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

// Cada lectura del feed no puede escribir una fila de auditoría: Google Calendar reconsulta
// solo, y en un colegio con cientos de suscriptores eso inunda audit_logs y deja de servir
// para lo que existe. Se registra el uso a lo sumo una vez por hora y por token; `lastUsedAt`
// se actualiza siempre, así que el "¿este token sigue vivo?" no pierde precisión.
const USAGE_AUDIT_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class CalendarFeedService {
  private readonly logger = new Logger(CalendarFeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAdmin: PlatformAdminPrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
    private readonly audit: AuditService,
    private readonly audience: AudienceScopeService,
    private readonly events: EventsService,
    private readonly config: ConfigService,
  ) {}

  // ─── Gestión del token (con sesión) ─────────────────────────────────────────

  /**
   * Emite un token nuevo para el actor y revoca el anterior.
   *
   * El token en claro se devuelve **una sola vez**: de ahí en adelante solo queda su hash,
   * así que "ver mi URL de nuevo" no existe — se regenera, y eso invalida la suscripción
   * anterior. Es a propósito: una capability URL que se puede volver a mostrar es una
   * credencial recuperable desde cualquier sesión abierta.
   */
  async issueToken(actor: RequestUser, request: Request) {
    const rawToken = randomBytes(32).toString("base64url");

    await this.prisma.calendarFeedToken.updateMany({
      where: { tenantId: actor.tenantId, userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const created = await this.prisma.calendarFeedToken.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.id,
        tokenHash: this.hashToken(rawToken),
      },
      select: { id: true, createdAt: true },
    });

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "calendar.feed_token.issued",
      entityType: "CalendarFeedToken",
      entityId: created.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    const urls = this.buildUrls(rawToken);
    return {
      ...urls,
      createdAt: created.createdAt,
      // QR de la URL webcal: en la práctica el caso de uso es "lo abro en el teléfono".
      qrDataUrl: await QRCode.toDataURL(urls.webcalUrl, { margin: 1, width: 320 }),
    };
  }

  async revokeToken(actor: RequestUser, request: Request) {
    const { count } = await this.prisma.calendarFeedToken.updateMany({
      where: { tenantId: actor.tenantId, userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count > 0) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.id,
        actorRole: actor.role,
        action: "calendar.feed_token.revoked",
        entityType: "CalendarFeedToken",
        entityId: actor.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
    }

    return { revoked: count };
  }

  /** Estado de la suscripción, sin el secreto (que ya no existe en claro). */
  async getTokenStatus(actor: RequestUser) {
    const token = await this.prisma.calendarFeedToken.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.id, revokedAt: null },
      select: { createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      active: Boolean(token),
      createdAt: token?.createdAt ?? null,
      lastUsedAt: token?.lastUsedAt ?? null,
    };
  }

  // ─── El feed (sin sesión) ───────────────────────────────────────────────────

  /**
   * Renderiza el feed ICS de quien sea dueño del token.
   *
   * **Este es el método que §7.7 del plan marca como el más delicado del calendario.** Corre
   * sin JWT y sin `x-tenant-slug` —lo consume Google Calendar o Apple, que no mandan ninguno
   * de los dos—, así que `TenantRlsContextInterceptor` no setea nada y sin hacer más el feed
   * devolvería cero eventos, siempre y en silencio.
   */
  async renderFeed(rawToken: string, request: Request) {
    const token = await this.resolveTokenAcrossTenants(rawToken);

    // 404 y no 403: un token inválido, revocado o inexistente son indistinguibles desde
    // afuera. Confirmar que un token existe pero está revocado le regala información a quien
    // esté probando URLs.
    if (!token || token.revokedAt) {
      throw new NotFoundException("Feed no encontrado.");
    }

    // Desde acá adentro todo corre con el tenant del token. Es la parte que hace que el feed
    // no sea un calendario vacío.
    return this.tenantRlsContext.runWithTenant(token.tenantId, async () => {
      const actor = await this.buildActorFromToken(token.tenantId, token.userId);
      if (!actor) {
        // El usuario perdió la membresía (egresó, lo desactivaron). El token sigue existiendo
        // pero ya no representa a nadie con acceso.
        throw new NotFoundException("Feed no encontrado.");
      }

      const timezone = await resolveTenantTimezone(this.prisma, token.tenantId);
      const now = new Date();
      const from = new Date(now.getTime() - FEED_DAYS_BACK * DAY_MS);
      const to = new Date(now.getTime() + FEED_DAYS_FORWARD * DAY_MS);

      const items = [
        ...(await this.eventItems(actor, from, to)),
        ...(await this.homeworkItems(actor, from, to)),
      ];

      await this.registerUsage(token, actor, request);

      return {
        body: buildIcsCalendar({
          name: `${actor.tenantName} — Calendario`,
          timezone,
          items,
        }),
        filename: "classia-calendario.ics",
      };
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * El único lugar del módulo que usa el rol de bypass, y solo para esto: traducir un token a
   * su tenant.
   *
   * Es el mismo problema del login y del refresh —que `CLAUDE.md` ya reconoce como usos
   * legítimos del bypass— y es circular por construcción: `calendar_feed_tokens` es
   * tenant-owned con RLS forzado, así que buscar el token para *averiguar* el tenant necesita
   * un tenant que todavía no se conoce.
   *
   * Lo que §7.7 prohíbe, y que acá no se hace, es leer **los eventos** con el bypass. La
   * consulta de abajo devuelve solo el ids/tenant/usuario/revocación del token, se busca por
   * hash exacto (no hay listado ni enumeración posible) y todo lo demás corre con el rol de
   * la app bajo `runWithTenant`.
   */
  private async resolveTokenAcrossTenants(rawToken: string) {
    return this.platformAdmin.get().calendarFeedToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      select: { id: true, tenantId: true, userId: true, revokedAt: true, lastUsedAt: true },
    });
  }

  /**
   * Reconstruye el actor a partir de su membresía para poder reusar el filtrado de siempre.
   *
   * Sin esto habría que reimplementar la audiencia dentro del feed, y el requisito es que el
   * feed muestre **exactamente** lo que vería el dueño del token llamando a la API.
   */
  private async buildActorFromToken(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, status: "ACTIVE" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true } },
        tenant: { select: { slug: true, name: true } },
      },
    });

    if (!membership) return null;

    const actor: RequestUser & { tenantName: string } = {
      id: membership.user.id,
      email: membership.user.email,
      tenantId,
      tenantSlug: membership.tenant.slug,
      tenantName: membership.tenant.name,
      membershipId: membership.id,
      role: membership.role,
    };
    return actor;
  }

  /** Eventos del calendario, con la misma audiencia que `GET /events`. */
  private async eventItems(actor: RequestUser, from: Date, to: Date): Promise<IcsItem[]> {
    // Se llama a EventsService y no a Prisma directo justamente para no duplicar la
    // audiencia: si mañana cambia quién ve qué, el feed cambia con ella.
    const events = await this.events.list(actor, { from, to });

    return events.map((event) => ({
      uid: `event-${event.id}@${actor.tenantSlug}.classia`,
      summary: event.title,
      description: event.description,
      location: event.location,
      start: event.startsAt,
      end: event.endsAt,
      allDay: event.allDay,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }));
  }

  /**
   * Fechas de entrega de tareas (§9.6 del plan: el feed incluye las entregas del alumno).
   *
   * Solo para alumno y acudiente — a un profesor o a la administración les saturaría el
   * calendario con las entregas de todos sus grupos, y el valor de §9.6 es que la familia vea
   * cuándo entrega su hijo.
   *
   * **Nada sensible en el SUMMARY**: título y materia, y punto. Ni notas, ni estado de
   * entrega, ni montos. La URL viaja en claro y queda en los logs del cliente.
   */
  private async homeworkItems(actor: RequestUser, from: Date, to: Date): Promise<IcsItem[]> {
    if (actor.role !== UserRole.STUDENT && actor.role !== UserRole.GUARDIAN) {
      return [];
    }

    const groupIds = await this.audience.resolveUserGroupIds(actor);
    if (groupIds.length === 0) return [];

    const homework = await this.prisma.homework.findMany({
      where: {
        tenantId: actor.tenantId,
        groupId: { in: groupIds },
        status: "ACTIVE",
        dueDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        createdAt: true,
        subject: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return homework.map((task) => ({
      uid: `homework-${task.id}@${actor.tenantSlug}.classia`,
      summary: `Entrega: ${task.title} (${task.subject.name})`,
      // Una entrega es un instante, no un bloque: se muestra como evento de 30 minutos que
      // termina en la hora límite, para que quede visible sin tapar el resto del día.
      start: new Date(task.dueDate.getTime() - 30 * 60 * 1000),
      end: task.dueDate,
      allDay: false,
      createdAt: task.createdAt,
      // Homework no tiene updatedAt en el modelo, así que el DTSTAMP usa la fecha de
      // creación. Consecuencia asumida: mover la fecha de entrega de una tarea ya publicada
      // no sube el SEQUENCE y algunos clientes pueden tardar en reflejarlo. Si eso molesta,
      // el arreglo es agregarle updatedAt a Homework, no inventar un SEQUENCE acá.
      updatedAt: task.createdAt,
    }));
  }

  /** Marca el uso y lo audita, como mucho una vez por hora (ver USAGE_AUDIT_INTERVAL_MS). */
  private async registerUsage(
    token: { id: string; tenantId: string; userId: string; lastUsedAt: Date | null },
    actor: RequestUser,
    request: Request,
  ) {
    const now = new Date();
    const shouldAudit =
      !token.lastUsedAt || now.getTime() - token.lastUsedAt.getTime() > USAGE_AUDIT_INTERVAL_MS;

    await this.prisma.calendarFeedToken.update({
      where: { id: token.id },
      data: { lastUsedAt: now },
    });

    if (!shouldAudit) return;

    await this.audit.record({
      tenantId: token.tenantId,
      userId: token.userId,
      actorRole: actor.role,
      action: "calendar.feed_token.used",
      entityType: "CalendarFeedToken",
      entityId: token.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  private buildUrls(rawToken: string) {
    const apiUrl = this.config.get<string>("app.apiUrl") ?? "http://localhost:3001";
    const feedUrl = `${apiUrl}/calendar/feed/${rawToken}.ics`;
    return {
      feedUrl,
      // webcal:// hace que el sistema operativo ofrezca suscribirse en vez de descargar el
      // archivo una vez, que es la diferencia entre "se actualiza solo" y "no se actualiza".
      webcalUrl: feedUrl.replace(/^https?:\/\//, "webcal://"),
    };
  }

  private hashToken(rawToken: string) {
    // sha256 y no bcrypt: la búsqueda es por el token que llega en la URL y un hash con sal
    // no se puede indexar. Mismo criterio que AuthSession.refreshTokenHash. Es seguro porque
    // son 32 bytes aleatorios, no una contraseña elegida por una persona.
    return createHash("sha256").update(rawToken).digest("hex");
  }
}
