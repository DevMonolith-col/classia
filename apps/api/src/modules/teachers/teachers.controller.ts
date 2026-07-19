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
  CreateTeacherInput,
  UpdateTeacherInput,
  createTeacherSchema,
  updateTeacherSchema,
} from "./teachers.schemas";
import { TeachersService } from "./teachers.service";

@Controller("teachers")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.DATOS_PERSONALES)
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  @Permissions(PERMISSIONS.TEACHERS_LIST)
  list(@CurrentUser() user: RequestUser, @Query("tenantId") tenantId?: string) {
    return this.teachers.list(user, tenantId);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.TEACHERS_READ)
  findOne(@Param("id") teacherId: string, @CurrentUser() user: RequestUser) {
    return this.teachers.findOne(teacherId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.TEACHERS_CREATE)
  create(
    @Body(new ZodValidationPipe(createTeacherSchema)) body: CreateTeacherInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.teachers.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.TEACHERS_UPDATE)
  update(
    @Param("id") teacherId: string,
    @Body(new ZodValidationPipe(updateTeacherSchema)) body: UpdateTeacherInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.teachers.update(teacherId, body, user, request);
  }
}
