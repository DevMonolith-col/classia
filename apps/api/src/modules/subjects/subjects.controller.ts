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
  CreateSubjectInput,
  UpdateSubjectInput,
  createSubjectSchema,
  updateSubjectSchema,
} from "./subjects.schemas";
import { SubjectsService } from "./subjects.service";

@Controller("subjects")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.OPERATIVO)
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @Permissions(PERMISSIONS.SUBJECTS_LIST)
  list(@CurrentUser() user: RequestUser, @Query("tenantId") tenantId?: string) {
    return this.subjects.list(user, tenantId);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.SUBJECTS_READ)
  findOne(@Param("id") subjectId: string, @CurrentUser() user: RequestUser) {
    return this.subjects.findOne(subjectId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  create(
    @Body(new ZodValidationPipe(createSubjectSchema)) body: CreateSubjectInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.subjects.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.SUBJECTS_UPDATE)
  update(
    @Param("id") subjectId: string,
    @Body(new ZodValidationPipe(updateSubjectSchema)) body: UpdateSubjectInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.subjects.update(subjectId, body, user, request);
  }
}
