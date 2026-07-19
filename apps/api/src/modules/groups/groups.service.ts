import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateGroupInput, UpdateGroupInput } from "./groups.schemas";

@Injectable()
export class GroupsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser, tenantId?: string) {
    const scopedTenantId = this.resolveTenantScope(actor, tenantId);

    return this.prisma.group.findMany({
      where: scopedTenantId ? { tenantId: scopedTenantId } : undefined,
      select: this.groupSelect(),
      orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
    });
  }

  async findOne(groupId: string, actor: RequestUser) {
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: this.groupSelect(),
    });

    this.assertCanAccessTenant(group.tenant.id, actor);

    return group;
  }

  async create(input: CreateGroupInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for groups.");
    }

    const group = await this.prisma.group.create({
      data: {
        tenantId,
        name: input.name,
        grade: input.grade,
        section: input.section,
      },
      select: this.groupSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "group.created",
      entityType: "Group",
      entityId: group.id,
      newValues: this.toAuditJson(group),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return group;
  }

  async update(
    groupId: string,
    input: UpdateGroupInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: this.groupSelect(),
    });

    this.assertCanAccessTenant(previous.tenant.id, actor);

    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: input,
      select: this.groupSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenant.id,
      userId: actor.id,
      actorRole: actor.role,
      action: "group.updated",
      entityType: "Group",
      entityId: group.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(group),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return group;
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

  private groupSelect() {
    return {
      id: true,
      name: true,
      grade: true,
      section: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          students: true,
          schedules: true,
          attendanceSessions: true,
          homework: true,
        },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
