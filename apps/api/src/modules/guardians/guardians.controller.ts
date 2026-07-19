import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AccessScope } from "@prisma/client";
import { DataScope } from "../../common/decorators/data-scope.decorator";
import { DataScopeGuard } from "../../common/guards/data-scope.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  CreateGuardianInput,
  UpdateGuardianInput,
  createGuardianSchema,
  updateGuardianSchema,
} from "./guardians.schemas";
import { GuardiansService } from "./guardians.service";

@Controller("guardians")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.DATOS_PERSONALES)
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  @Get()
  @Permissions(PERMISSIONS.GUARDIANS_LIST)
  list(@CurrentUser() user: RequestUser, @Query("tenantId") tenantId?: string) {
    return this.guardians.list(user, tenantId);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.GUARDIANS_READ)
  findOne(@Param("id") guardianId: string, @CurrentUser() user: RequestUser) {
    return this.guardians.findOne(guardianId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.GUARDIANS_CREATE)
  create(
    @Body(new ZodValidationPipe(createGuardianSchema)) body: CreateGuardianInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.guardians.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.GUARDIANS_UPDATE)
  update(
    @Param("id") guardianId: string,
    @Body(new ZodValidationPipe(updateGuardianSchema)) body: UpdateGuardianInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.guardians.update(guardianId, body, user, request);
  }
}
