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
  CreateGroupInput,
  UpdateGroupInput,
  createGroupSchema,
  updateGroupSchema,
} from "./groups.schemas";
import { GroupsService } from "./groups.service";

@Controller("groups")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.OPERATIVO)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @Permissions(PERMISSIONS.GROUPS_LIST)
  list(@CurrentUser() user: RequestUser, @Query("tenantId") tenantId?: string) {
    return this.groups.list(user, tenantId);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.GROUPS_READ)
  findOne(@Param("id") groupId: string, @CurrentUser() user: RequestUser) {
    return this.groups.findOne(groupId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.GROUPS_CREATE)
  create(
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.groups.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.GROUPS_UPDATE)
  update(
    @Param("id") groupId: string,
    @Body(new ZodValidationPipe(updateGroupSchema)) body: UpdateGroupInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.groups.update(groupId, body, user, request);
  }
}
