import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TenantStatus } from "@prisma/client";
import { Request } from "express";
import { extractTenantSlugFromHost } from "../../common/utils/tenant-host.util";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantContextService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveTenant(request: Request) {
    const tenantSlug = this.resolveTenantSlug(request);

    if (!tenantSlug) {
      throw new UnauthorizedException("Tenant context is required.");
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { primaryDomain: request.hostname }],
        status: {
          in: [TenantStatus.ACTIVE, TenantStatus.DEMO, TenantStatus.PILOT],
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    return tenant;
  }

  private resolveTenantSlug(request: Request) {
    const nodeEnv = this.config.get<string>("app.nodeEnv");
    const headerTenant = request.headers["x-tenant-slug"];

    if (nodeEnv !== "production" && typeof headerTenant === "string") {
      return headerTenant;
    }

    const appDomain = this.config.get<string>("app.domain") ?? "classia.com.co";

    return extractTenantSlugFromHost(request.hostname, appDomain);
  }
}
