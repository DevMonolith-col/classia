import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestTenant, RequestUser } from "../../common/types/request-context";
import {
  CreateTenantInput,
  UpdateTenantInput,
  createTenantSchema,
  updateTenantSchema,
} from "./tenants.schemas";
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

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.TENANTS_CREATE)
  create(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.tenants.create(body, user, request);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.TENANTS_READ)
  findOne(@Param("id") tenantId: string, @CurrentUser() user: RequestUser) {
    return this.tenants.findVisibleTenant(tenantId, user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.TENANTS_UPDATE)
  update(
    @Param("id") tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.tenants.update(tenantId, body, user, request);
  }
}
