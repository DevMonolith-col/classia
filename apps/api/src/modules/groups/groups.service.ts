import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { AudienceScopeService } from "../../common/audience/audience-scope.service";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateGroupInput, UpdateGroupInput } from "./groups.schemas";

@Injectable()
export class GroupsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly audience: AudienceScopeService,
  ) {}

  list(actor: RequestUser, tenantId?: string) {
    const scopedTenantId = this.resolveTenantScope(actor, tenantId);

    return this.prisma.group.findMany({
      where: scopedTenantId ? { tenantId: scopedTenantId } : undefined,
      select: this.groupSelect(),
      orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Conteos agregados de "mis grupos" (backlog "Rendimiento y Escalabilidad" 1.2):
   * el dashboard del profesor pedía `GET /students?groupId=` por cada grupo que
   * dicta, solo para contar estudiantes -- un N+1 clásico (una llamada HTTP y una
   * query por grupo). Acá se resuelve en dos queries totales sin importar cuántos
   * grupos tenga el profesor: una para los grupos, una `groupBy` agregada para los
   * conteos. Un estudiante pertenece a un solo grupo (`Student.groupId`), así que
   * sumar los conteos por grupo da el total real sin necesitar deduplicar.
   */
  async statsMine(actor: RequestUser) {
    const groupIds = await this.audience.resolveTeacherGroupIds(actor);
    if (groupIds.length === 0) return [];

    const [groups, counts] = await Promise.all([
      this.prisma.group.findMany({
        where: { id: { in: groupIds }, tenantId: actor.tenantId },
        select: { id: true, name: true, grade: true, section: true },
        orderBy: [{ grade: "asc" }, { section: "asc" }],
      }),
      this.prisma.student.groupBy({
        by: ["groupId"],
        where: { groupId: { in: groupIds }, tenantId: actor.tenantId, isActive: true },
        _count: { _all: true },
      }),
    ]);

    const studentCountByGroup = new Map(counts.map((c) => [c.groupId, c._count._all]));

    return groups.map((group) => ({
      groupId: group.id,
      name: group.name,
      grade: group.grade,
      section: group.section,
      studentCount: studentCountByGroup.get(group.id) ?? 0,
    }));
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
