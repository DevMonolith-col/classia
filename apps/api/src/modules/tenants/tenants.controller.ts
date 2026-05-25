import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { RequestTenant, RequestUser } from "../../common/types/request-context";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get("current")
  @UseGuards(TenantGuard)
  current(@CurrentTenant() tenant: RequestTenant) {
    return tenant;
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.TENANTS_LIST)
  list() {
    return this.tenants.list();
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.TENANTS_READ)
  findOne(@Param("id") tenantId: string, @CurrentUser() user: RequestUser) {
    return this.tenants.findVisibleTenant(tenantId, user);
  }
}
