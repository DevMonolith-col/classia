import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateTenantInput, UpdateTenantInput } from "./tenants.schemas";

@Injectable()
export class TenantsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  list() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        primaryDomain: true,
        status: true,
        logoUrl: true,
        brandColor: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async create(input: CreateTenantInput, user: RequestUser, request: Request) {
    this.assertGlobalAdmin(user);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        primaryDomain: input.primaryDomain,
        status: input.status,
        logoUrl: input.logoUrl,
        brandColor: input.brandColor,
      },
      select: this.tenantSelect(),
    });

    await this.audit.record({
      tenantId: tenant.id,
      userId: user.id,
      action: "tenant.created",
      entityType: "Tenant",
      entityId: tenant.id,
      newValues: this.toAuditJson(tenant),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return tenant;
  }

  findVisibleTenant(tenantId: string, user: RequestUser) {
    const canReadAcrossTenants =
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SUPPORT_AGENT;

    if (!canReadAcrossTenants && user.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: this.tenantSelect(),
    });
  }

  async update(
    tenantId: string,
    input: UpdateTenantInput,
    user: RequestUser,
    request: Request,
  ) {
    const canUpdateAcrossTenants = user.role === UserRole.SUPER_ADMIN;

    if (!canUpdateAcrossTenants && user.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    if (!canUpdateAcrossTenants && input.status) {
      throw new ForbiddenException("Only super admins can update tenant status.");
    }

    const previous = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: this.tenantSelect(),
    });
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: input,
      select: this.tenantSelect(),
    });

    await this.audit.record({
      tenantId: tenant.id,
      userId: user.id,
      action: "tenant.updated",
      entityType: "Tenant",
      entityId: tenant.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(tenant),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return tenant;
  }

  private assertGlobalAdmin(user: RequestUser) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only super admins can perform this action.");
    }
  }

  private tenantSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      primaryDomain: true,
      status: true,
      logoUrl: true,
      brandColor: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
