import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequestUser } from "../../common/types/request-context";
import { PrismaService } from "../../core/prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

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

  findVisibleTenant(tenantId: string, user: RequestUser) {
    const canReadAcrossTenants =
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SUPPORT_AGENT;

    if (!canReadAcrossTenants && user.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
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
    });
  }
}
