import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateStudentInput, UpdateStudentInput } from "./students.schemas";

@Injectable()
export class StudentsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser, tenantId?: string, groupId?: string) {
    const scopedTenantId = this.resolveTenantScope(actor, tenantId);

    return this.prisma.student.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        ...(groupId ? { groupId } : {}),
      },
      select: this.studentSelect(),
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }

  async findOne(studentId: string, actor: RequestUser) {
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: this.studentSelect(),
    });

    this.assertCanAccessTenant(student.tenant.id, actor);

    return student;
  }

  async create(input: CreateStudentInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for students.");
    }

    await this.assertGroupBelongsToTenant(input.groupId ?? undefined, tenantId);
    await this.assertGuardiansBelongToTenant(input.guardianIds, tenantId);

    const student = await this.prisma.student.create({
      data: {
        tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        documentId: input.documentId,
        birthDate: input.birthDate,
        groupId: input.groupId ?? null,
        isActive: input.isActive ?? true,
        guardians: input.guardianIds?.length
          ? {
              create: input.guardianIds.map((guardianId) => ({
                guardianId,
                tenantId,
              })),
            }
          : undefined,
      },
      select: this.studentSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "student.created",
      entityType: "Student",
      entityId: student.id,
      newValues: this.toAuditJson(student),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return student;
  }

  async update(
    studentId: string,
    input: UpdateStudentInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: this.studentSelect(),
    });

    this.assertCanAccessTenant(previous.tenant.id, actor);
    await this.assertGroupBelongsToTenant(input.groupId ?? undefined, previous.tenant.id);
    await this.assertGuardiansBelongToTenant(input.guardianIds, previous.tenant.id);

    const student = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        documentId: input.documentId === null ? null : input.documentId,
        birthDate: input.birthDate === null ? null : input.birthDate,
        groupId: input.groupId === null ? null : input.groupId,
        isActive: input.isActive,
        ...(input.guardianIds
          ? {
              guardians: {
                deleteMany: {},
                create: input.guardianIds.map((guardianId) => ({ guardianId, tenantId: previous.tenant.id })),
              },
            }
          : {}),
      },
      select: this.studentSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenant.id,
      userId: actor.id,
      actorRole: actor.role,
      action: "student.updated",
      entityType: "Student",
      entityId: student.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(student),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return student;
  }

  private async assertGroupBelongsToTenant(groupId: string | undefined, tenantId: string) {
    if (!groupId) {
      return;
    }

    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });

    if (!group) {
      throw new ForbiddenException("Group is outside of current tenant.");
    }
  }

  private async assertGuardiansBelongToTenant(
    guardianIds: string[] | undefined,
    tenantId: string,
  ) {
    if (!guardianIds?.length) {
      return;
    }

    const guardians = await this.prisma.guardian.findMany({
      where: {
        id: { in: guardianIds },
        tenantId,
      },
      select: { id: true },
    });

    if (guardians.length !== new Set(guardianIds).size) {
      throw new ForbiddenException("One or more guardians are outside of current tenant.");
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

  private studentSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      documentId: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          grade: true,
          section: true,
        },
      },
      guardians: {
        select: {
          relationship: true,
          isPrimary: true,
          guardian: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
