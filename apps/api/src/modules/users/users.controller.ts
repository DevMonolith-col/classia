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
  CreateMembershipInput,
  CreateUserInput,
  UpdateMembershipInput,
  UpdateUserInput,
  createMembershipSchema,
  createUserSchema,
  updateMembershipSchema,
  updateUserSchema,
  listUsersSchema,
  ListUsersInput,
} from "./users.schemas";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.DATOS_PERSONALES)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @Permissions(PERMISSIONS.USERS_READ_SELF)
  me(@CurrentUser() user: RequestUser) {
    return this.users.findMe(user.id);
  }

  @Get("me/memberships")
  @Permissions(PERMISSIONS.USERS_READ_MEMBERSHIPS)
  memberships(@CurrentUser() user: RequestUser) {
    return this.users.findMyMemberships(user.id);
  }

  @Get()
  @Permissions(PERMISSIONS.USERS_LIST)
  list(
    @Query(new ZodValidationPipe(listUsersSchema)) query: ListUsersInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.users.listVisibleUsers(user, query);
  }

  @Post()
  @Permissions(PERMISSIONS.USERS_CREATE)
  create(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.users.create(body, user, request);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.USERS_READ)
  findOne(@Param("id") userId: string, @CurrentUser() user: RequestUser) {
    return this.users.findVisibleUser(userId, user);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.USERS_UPDATE)
  update(
    @Param("id") userId: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.users.update(userId, body, user, request);
  }

  @Post(":id/memberships")
  @Permissions(PERMISSIONS.MEMBERSHIPS_CREATE)
  createMembership(
    @Param("id") userId: string,
    @Body(new ZodValidationPipe(createMembershipSchema))
    body: CreateMembershipInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.users.createMembership(userId, body, user, request);
  }

  @Patch(":id/memberships/:membershipId")
  @Permissions(PERMISSIONS.MEMBERSHIPS_UPDATE)
  updateMembership(
    @Param("id") userId: string,
    @Param("membershipId") membershipId: string,
    @Body(new ZodValidationPipe(updateMembershipSchema))
    body: UpdateMembershipInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.users.updateMembership(userId, membershipId, body, user, request);
  }
}
