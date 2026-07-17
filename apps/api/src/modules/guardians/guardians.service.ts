import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateGuardianInput, UpdateGuardianInput } from "./guardians.schemas";

@Injectable()
export class GuardiansService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser, tenantId?: string) {
    const scopedTenantId = this.resolveTenantScope(actor, tenantId);

    return this.prisma.guardian.findMany({
      where: scopedTenantId ? { tenantId: scopedTenantId } : undefined,
      select: this.guardianSelect(),
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });
  }

  async findOne(guardianId: string, actor: RequestUser) {
    const guardian = await this.prisma.guardian.findUniqueOrThrow({
      where: { id: guardianId },
      select: this.guardianSelect(),
    });

    this.assertCanAccessTenant(guardian.tenantId, actor);

    return guardian;
  }

  async create(input: CreateGuardianInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for guardians.");
    }

    await this.assertGuardianCandidate(input.userId, tenantId);

    const guardian = await this.prisma.guardian.create({
      data: {
        tenantId,
        userId: input.userId,
      },
      select: this.guardianSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "guardian.created",
      entityType: "Guardian",
      entityId: guardian.id,
      newValues: this.toAuditJson(guardian),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return guardian;
  }

  async update(
    guardianId: string,
    input: UpdateGuardianInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.guardian.findUniqueOrThrow({
      where: { id: guardianId },
      select: this.guardianSelect(),
    });

    this.assertCanAccessTenant(previous.tenantId, actor);

    if (input.userId) {
      await this.assertGuardianCandidate(input.userId, previous.tenantId, guardianId);
    }

    const guardian = await this.prisma.guardian.update({
      where: { id: guardianId },
      data: {
        userId: input.userId,
      },
      select: this.guardianSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "guardian.updated",
      entityType: "Guardian",
      entityId: guardian.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(guardian),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return guardian;
  }

  private async assertGuardianCandidate(
    userId: string,
    tenantId: string,
    guardianIdToExclude?: string,
  ) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        role: UserRole.GUARDIAN,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("User must have a GUARDIAN membership in this tenant.");
    }

    const existing = await this.prisma.guardian.findFirst({
      where: {
        userId,
        ...(guardianIdToExclude ? { id: { not: guardianIdToExclude } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ForbiddenException("User already has a guardian profile.");
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

  private guardianSelect() {
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
      students: {
        select: {
          relationship: true,
          isPrimary: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              group: {
                select: {
                  id: true,
                  name: true,
                  grade: true,
                  section: true,
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
