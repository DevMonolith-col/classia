import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { AudienceScopeService } from "../../common/audience/audience-scope.service";
import { resolveTenantTimezone } from "../../common/time/tenant-timezone";
import { zonedDayBounds } from "../../common/time/zoned-time";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateEventInput, ListEventsQuery, UpdateEventInput } from "./events.schemas";

// Los mismos roles que en announcements.service.ts: publican para todo el colegio, a
// cualquier grupo y a cualquier rol.
const ADMIN_STAFF_ROLES: UserRole[] = [
  UserRole.TENANT_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.COORDINATOR,
  UserRole.SECRETARY,
];

const DEFAULT_UPCOMING_LIMIT = 5;

@Injectable()
export class EventsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly audience: AudienceScopeService,
  ) {}

  async list(actor: RequestUser, query: ListEventsQuery) {
    const scopedTenantId = this.resolveTenantScope(actor, query.tenantId);

    // Modo rango si viene `to` (la grilla); si no, "próximos N" (el widget del dashboard).
    // Ver el comentario de listEventsQuerySchema: son dos preguntas distintas.
    const isRange = Boolean(query.to);
    const startsAt: Prisma.DateTimeFilter = isRange
      ? { gte: query.from, lte: query.to }
      : { gte: query.from ?? new Date() };

    return this.prisma.event.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        deletedAt: null,
        startsAt,
        ...(await this.audienceFilter(actor)),
      },
      select: this.eventSelect(),
      orderBy: { startsAt: "asc" },
      // En modo rango la ventana acotada del schema es la protección, así que `limit` solo
      // se aplica si el cliente lo pidió explícitamente. Recortar un mes a 5 eventos por
      // default sería un cap silencioso.
      ...(isRange
        ? query.limit
          ? { take: query.limit }
          : {}
        : { take: query.limit ?? DEFAULT_UPCOMING_LIMIT }),
    });
  }

  async findOne(eventId: string, actor: RequestUser) {
    const scopedTenantId = this.resolveTenantScope(actor);

    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        deletedAt: null,
        // El filtro de audiencia va en el WHERE y no en un chequeo posterior a propósito:
        // así un evento dirigido solo a profesores devuelve 404 —no 403— a un acudiente
        // que adivine el id, y no confirma que el evento existe.
        ...(await this.audienceFilter(actor)),
      },
      select: this.eventSelect(),
    });

    if (!event) {
      throw new NotFoundException("Evento no encontrado.");
    }

    return event;
  }

  async create(input: CreateEventInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for events.");
    }

    const groupId = await this.resolveWritableGroupId(actor, tenantId, input.groupId ?? null);

    if (input.isSchoolDayOff && !this.canDeclareSchoolDayOff(actor)) {
      // Declarar un día no lectivo no es informativo: lo consume asistencia y afecta a todo
      // el colegio. Es decisión institucional, no de un profesor.
      throw new ForbiddenException("Solo la administración puede marcar un día como no lectivo.");
    }

    const { startsAt, endsAt } = await this.normalizeRange(
      tenantId,
      input.startsAt,
      input.endsAt,
      input.allDay,
    );

    const event = await this.prisma.event.create({
      data: {
        tenantId,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        startsAt,
        endsAt,
        allDay: input.allDay,
        location: input.location ?? null,
        targetRole: input.targetRole ?? null,
        groupId,
        isSchoolDayOff: input.isSchoolDayOff,
        reminderMinutesBefore: input.reminderMinutesBefore ?? null,
        createdById: actor.id,
      },
      select: this.eventSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "event.created",
      entityType: "Event",
      entityId: event.id,
      newValues: this.toAuditJson(event),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return event;
  }

  async update(eventId: string, input: UpdateEventInput, actor: RequestUser, request: Request) {
    const previous = await this.loadForWrite(eventId, actor);

    const groupId =
      input.groupId === undefined
        ? previous.groupId
        : await this.resolveWritableGroupId(actor, previous.tenantId, input.groupId ?? null);

    // Solo se bloquea si de verdad lo está cambiando: un PATCH que reenvía el objeto
    // completo con el mismo valor no tiene por qué fallar.
    if (
      input.isSchoolDayOff !== undefined &&
      input.isSchoolDayOff !== previous.isSchoolDayOff &&
      !this.canDeclareSchoolDayOff(actor)
    ) {
      throw new ForbiddenException("Solo la administración puede marcar un día como no lectivo.");
    }

    // Se fusiona con la fila existente antes de validar: un PATCH que solo manda `endsAt`
    // tiene que compararse contra el `startsAt` guardado, no quedar sin validar.
    const allDay = input.allDay ?? previous.allDay;
    const mergedStartsAt = input.startsAt ?? previous.startsAt;
    const mergedEndsAt = input.endsAt ?? previous.endsAt;

    if (mergedEndsAt.getTime() < mergedStartsAt.getTime()) {
      throw new BadRequestException("'endsAt' no puede ser anterior a 'startsAt'.");
    }

    const { startsAt, endsAt } = await this.normalizeRange(
      previous.tenantId,
      mergedStartsAt,
      mergedEndsAt,
      allDay,
    );

    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.location !== undefined ? { location: input.location ?? null } : {}),
        ...(input.targetRole !== undefined ? { targetRole: input.targetRole ?? null } : {}),
        ...(input.groupId !== undefined ? { groupId } : {}),
        ...(input.isSchoolDayOff !== undefined ? { isSchoolDayOff: input.isSchoolDayOff } : {}),
        ...(input.reminderMinutesBefore !== undefined
          ? { reminderMinutesBefore: input.reminderMinutesBefore ?? null }
          : {}),
        // startsAt/endsAt/allDay van siempre juntos: cambiar allDay renormaliza el rango
        // aunque las fechas no se hayan tocado.
        allDay,
        startsAt,
        endsAt,
      },
      select: this.eventSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "event.updated",
      entityType: "Event",
      entityId: eventId,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(event),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return event;
  }

  async remove(eventId: string, actor: RequestUser, request: Request) {
    const previous = await this.loadForWrite(eventId, actor);

    // Soft-delete, igual que Announcement: es comunicación institucional y la fila se
    // conserva (Ley 1620 / Ley 527). Antes de este cambio era un DELETE físico.
    await this.prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "event.deleted",
      entityType: "Event",
      entityId: eventId,
      oldValues: this.toAuditJson(previous),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { id: eventId };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Filtro de audiencia, portado de announcements.service.ts#listForUser. El staff
   * administrativo ve todo lo del colegio; el resto ve lo que creó más lo que le apunta por
   * rol y por grupo.
   */
  private async audienceFilter(actor: RequestUser): Promise<Prisma.EventWhereInput> {
    if (this.isAdminStaff(actor.role) || this.isGlobalAdmin(actor)) {
      return {};
    }

    const groupIds = await this.audience.resolveUserGroupIds(actor);

    return {
      OR: [
        { createdById: actor.id },
        {
          AND: [
            { OR: [{ targetRole: null }, { targetRole: actor.role }] },
            { OR: [{ groupId: null }, { groupId: { in: groupIds } }] },
          ],
        },
      ],
    };
  }

  /**
   * Carga el evento para escribir y decide si el actor puede tocarlo.
   *
   * La regla de ownership vive acá y no en un permiso de ruta porque "solo los eventos que
   * yo creé" es una condición por fila: ningún `@Permissions()` puede expresarla. Es el
   * mismo reparto que announcements (delete restringido al autor).
   */
  private async loadForWrite(eventId: string, actor: RequestUser) {
    const previous = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: this.eventSelect(),
    });

    if (!previous) {
      throw new NotFoundException("Evento no encontrado.");
    }

    this.assertCanAccessTenant(previous.tenantId, actor);

    if (
      !this.isAdminStaff(actor.role) &&
      !this.isGlobalAdmin(actor) &&
      previous.createdById !== actor.id
    ) {
      throw new ForbiddenException("Solo puedes modificar los eventos que creaste.");
    }

    return previous;
  }

  /**
   * Valida el grupo destino según quién escribe.
   *
   * - Staff administrativo: cualquier grupo del colegio, o `null` para todo el colegio.
   * - Profesor: **obligatorio** y solo uno de los grupos en los que tiene clase. Es el
   *   mismo reparto que announcements.service.ts#create.
   *
   * RLS no ayuda acá: el grupo de otro profesor es del mismo tenant, así que la política de
   * Postgres lo deja pasar. Esto es el único freno, y por eso tiene test propio.
   */
  private async resolveWritableGroupId(
    actor: RequestUser,
    tenantId: string,
    groupId: string | null,
  ): Promise<string | null> {
    if (this.isAdminStaff(actor.role) || this.isGlobalAdmin(actor)) {
      if (groupId) {
        await this.assertGroupInTenant(groupId, tenantId);
      }
      return groupId;
    }

    if (actor.role === UserRole.TEACHER) {
      if (!groupId) {
        throw new ForbiddenException("Debes seleccionar un grupo para crear un evento como profesor.");
      }
      const teacherGroupIds = await this.audience.resolveTeacherGroupIds(actor);
      if (!teacherGroupIds.includes(groupId)) {
        throw new ForbiddenException("Solo puedes crear eventos para los grupos que enseñas.");
      }
      return groupId;
    }

    throw new ForbiddenException("No tienes permiso para crear eventos.");
  }

  private async assertGroupInTenant(groupId: string, tenantId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });
    if (!group) {
      throw new ForbiddenException("El grupo no pertenece a tu institución.");
    }
  }

  /**
   * Un evento de todo el día se normaliza a los límites del día en la zona del colegio: de
   * 00:00:00.000 del día de `startsAt` a 23:59:59.999 del día de `endsAt`, hora local.
   *
   * Un evento así abarca días, no instantes, así que se toma la fecha civil de cada extremo
   * (ver zonedDayBounds, que explica por qué la lee de las partes UTC). Un rango de varios
   * días —"semana de desarrollo institucional"— se conserva completo: el inicio se ancla al
   * primer día y el fin al último, no los dos al mismo.
   *
   * Sin esto, "Día del Maestro" enviado como fecha aparece el día anterior para cualquiera
   * al oeste de Greenwich, incluida toda Colombia (UTC-5).
   */
  private async normalizeRange(tenantId: string, startsAt: Date, endsAt: Date, allDay: boolean) {
    if (!allDay) {
      return { startsAt, endsAt };
    }

    const timezone = await this.tenantTimezone(tenantId);
    return {
      startsAt: zonedDayBounds(startsAt, timezone).start,
      endsAt: zonedDayBounds(endsAt, timezone).end,
    };
  }

  private tenantTimezone(tenantId: string): Promise<string> {
    return resolveTenantTimezone(this.prisma, tenantId);
  }

  private canDeclareSchoolDayOff(actor: RequestUser) {
    return this.isAdminStaff(actor.role) || this.isGlobalAdmin(actor);
  }

  private isAdminStaff(role: UserRole) {
    return ADMIN_STAFF_ROLES.includes(role);
  }

  private resolveTenantScope(actor: RequestUser, tenantId?: string) {
    if (this.isGlobalAdmin(actor)) {
      return tenantId ?? actor.tenantId;
    }

    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    return actor.tenantId;
  }

  private assertCanAccessTenant(tenantId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private eventSelect() {
    return {
      id: true,
      tenantId: true,
      title: true,
      description: true,
      type: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      location: true,
      targetRole: true,
      groupId: true,
      isSchoolDayOff: true,
      reminderMinutesBefore: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
