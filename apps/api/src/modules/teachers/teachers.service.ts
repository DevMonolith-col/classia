import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateTeacherInput, UpdateTeacherInput } from "./teachers.schemas";

@Injectable()
export class TeachersService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser, tenantId?: string) {
    const scopedTenantId = this.resolveTenantScope(actor, tenantId);

    return this.prisma.teacher.findMany({
      where: scopedTenantId ? { tenantId: scopedTenantId } : undefined,
      select: this.teacherSelect(),
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });
  }

  async findOne(teacherId: string, actor: RequestUser) {
    const teacher = await this.prisma.teacher.findUniqueOrThrow({
      where: { id: teacherId },
      select: this.teacherSelect(),
    });

    this.assertCanAccessTenant(teacher.tenantId, actor);

    return teacher;
  }

  async create(input: CreateTeacherInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for teachers.");
    }

    await this.assertTeacherCandidate(input.userId, tenantId);

    const teacher = await this.prisma.teacher.create({
      data: {
        tenantId,
        userId: input.userId,
      },
      select: this.teacherSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "teacher.created",
      entityType: "Teacher",
      entityId: teacher.id,
      newValues: this.toAuditJson(teacher),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return teacher;
  }

  async update(
    teacherId: string,
    input: UpdateTeacherInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.teacher.findUniqueOrThrow({
      where: { id: teacherId },
      select: this.teacherSelect(),
    });

    this.assertCanAccessTenant(previous.tenantId, actor);

    if (input.userId) {
      await this.assertTeacherCandidate(input.userId, previous.tenantId, teacherId);
    }

    const teacher = await this.prisma.teacher.update({
      where: { id: teacherId },
      data: {
        userId: input.userId,
      },
      select: this.teacherSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "teacher.updated",
      entityType: "Teacher",
      entityId: teacher.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(teacher),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return teacher;
  }

  private async assertTeacherCandidate(
    userId: string,
    tenantId: string,
    teacherIdToExclude?: string,
  ) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        role: UserRole.TEACHER,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("User must have a TEACHER membership in this tenant.");
    }

    const existing = await this.prisma.teacher.findFirst({
      where: {
        userId,
        ...(teacherIdToExclude ? { id: { not: teacherIdToExclude } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ForbiddenException("User already has a teacher profile.");
    }
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

  private teacherSelect() {
    return {
      id: true,
      tenantId: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      },
      _count: {
        select: {
          schedules: true,
          attendanceSessions: true,
          marks: true,
          homework: true,
        },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
