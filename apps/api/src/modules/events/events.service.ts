import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateEventInput, ListEventsQuery } from "./events.schemas";

@Injectable()
export class EventsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser, query: ListEventsQuery) {
    const scopedTenantId = this.resolveTenantScope(actor, query.tenantId);

    return this.prisma.event.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        date: { gte: query.from ?? new Date() },
      },
      select: this.eventSelect(),
      orderBy: { date: "asc" },
      take: query.limit,
    });
  }

  async create(input: CreateEventInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for events.");
    }

    const event = await this.prisma.event.create({
      data: {
        tenantId,
        title: input.title,
        date: input.date,
        location: input.location,
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

  async remove(eventId: string, actor: RequestUser, request: Request) {
    const previous = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: this.eventSelect(),
    });

    this.assertCanAccessTenant(previous.tenantId, actor);

    await this.prisma.event.delete({ where: { id: eventId } });

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
      date: true,
      location: true,
      createdAt: true,
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
