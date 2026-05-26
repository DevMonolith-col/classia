import { ForbiddenException, Injectable } from "@nestjs/common";
import { MembershipStatus, Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Request } from "express";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { RequestUser } from "../../common/types/request-context";
import {
  CreateMembershipInput,
  CreateUserInput,
  UpdateMembershipInput,
  UpdateUserInput,
} from "./users.schemas";

@Injectable()
export class UsersService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findMyMemberships(userId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { userId },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            primaryDomain: true,
            status: true,
            logoUrl: true,
            brandColor: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  listVisibleUsers(user: RequestUser, tenantId?: string) {
    const targetTenantId = this.resolveTenantScope(user, tenantId);

    return this.prisma.user.findMany({
      where: targetTenantId
        ? {
            memberships: {
              some: {
                tenantId: targetTenantId,
              },
            },
          }
        : undefined,
      select: this.userSelect(),
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async findVisibleUser(userId: string, user: RequestUser) {
    await this.assertCanAccessUser(userId, user);

    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: this.userSelect(),
    });
  }

  async create(input: CreateUserInput, actor: RequestUser, request: Request) {
    const targetTenantId = this.resolveTenantScope(actor, input.tenantId);
    const role = input.role ?? UserRole.TENANT_ADMIN;

    this.assertCanAssignRole(actor, role);

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: input.status,
        ...(targetTenantId
          ? {
              memberships: {
                create: {
                  tenantId: targetTenantId,
                  role,
                  status: input.membershipStatus ?? MembershipStatus.ACTIVE,
                },
              },
            }
          : {}),
      },
      select: this.userSelect(),
    });

    await this.audit.record({
      tenantId: targetTenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      newValues: this.toAuditJson(user),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return user;
  }

  async update(
    userId: string,
    input: UpdateUserInput,
    actor: RequestUser,
    request: Request,
  ) {
    await this.assertCanAccessUser(userId, actor);
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: this.userSelect(),
    });
    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 12)
      : undefined;
    const { password, ...safeInput } = input;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...safeInput,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: this.userSelect(),
    });

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "user.updated",
      entityType: "User",
      entityId: updated.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(updated),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    void password;

    return updated;
  }

  async createMembership(
    userId: string,
    input: CreateMembershipInput,
    actor: RequestUser,
    request: Request,
  ) {
    const targetTenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!targetTenantId) {
      throw new ForbiddenException("Tenant is required for membership.");
    }

    this.assertCanAssignRole(actor, input.role);

    const membership = await this.prisma.tenantMembership.create({
      data: {
        userId,
        tenantId: targetTenantId,
        role: input.role,
        status: input.status ?? MembershipStatus.ACTIVE,
      },
      select: this.membershipSelect(),
    });

    await this.audit.record({
      tenantId: targetTenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "membership.created",
      entityType: "TenantMembership",
      entityId: membership.id,
      newValues: this.toAuditJson(membership),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return membership;
  }

  async updateMembership(
    userId: string,
    membershipId: string,
    input: UpdateMembershipInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.tenantMembership.findUniqueOrThrow({
      where: { id: membershipId },
      select: this.membershipSelect(),
    });

    if (previous.user.id !== userId) {
      throw new ForbiddenException("Membership does not belong to this user.");
    }

    this.assertCanAccessTenant(previous.tenant.id, actor);

    if (input.role) {
      this.assertCanAssignRole(actor, input.role);
    }

    const membership = await this.prisma.tenantMembership.update({
      where: { id: membershipId },
      data: input,
      select: this.membershipSelect(),
    });

    await this.audit.record({
      tenantId: membership.tenant.id,
      userId: actor.id,
      actorRole: actor.role,
      action: "membership.updated",
      entityType: "TenantMembership",
      entityId: membership.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(membership),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return membership;
  }

  private async assertCanAccessUser(userId: string, actor: RequestUser) {
    if (this.isGlobalAdmin(actor)) {
      return;
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId: actor.tenantId,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("User is outside of current tenant.");
    }
  }

  private assertCanAccessTenant(tenantId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }
  }

  private assertCanAssignRole(actor: RequestUser, role: UserRole) {
    if (this.isGlobalAdmin(actor)) {
      return;
    }

    if (role === UserRole.SUPER_ADMIN || role === UserRole.SUPPORT_AGENT) {
      throw new ForbiddenException("Only super admins can assign global roles.");
    }
  }

  private resolveTenantScope(actor: RequestUser, tenantId?: string) {
    if (this.isGlobalAdmin(actor)) {
      return tenantId;
    }

    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    return actor.tenantId;
  }

  private isGlobalAdmin(user: RequestUser) {
    return user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SUPPORT_AGENT;
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: {
          id: true,
          role: true,
          status: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
      },
    };
  }

  private membershipSelect() {
    return {
      id: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      },
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
