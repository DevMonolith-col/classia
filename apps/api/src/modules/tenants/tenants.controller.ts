import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RequestTenant } from "../../common/types/request-context";

@Controller("tenants")
export class TenantsController {
  @Get("current")
  @UseGuards(TenantGuard)
  current(@CurrentTenant() tenant: RequestTenant) {
    return tenant;
  }
}
