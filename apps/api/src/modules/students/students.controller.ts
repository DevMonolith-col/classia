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
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  CreateStudentInput,
  UpdateStudentInput,
  createStudentSchema,
  updateStudentSchema,
} from "./students.schemas";
import { StudentsService } from "./students.service";

@Controller("students")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @Permissions(PERMISSIONS.STUDENTS_LIST)
  list(
    @CurrentUser() user: RequestUser,
    @Query("tenantId") tenantId?: string,
    @Query("groupId") groupId?: string,
  ) {
    return this.students.list(user, tenantId, groupId);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.STUDENTS_READ)
  findOne(@Param("id") studentId: string, @CurrentUser() user: RequestUser) {
    return this.students.findOne(studentId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.STUDENTS_CREATE)
  create(
    @Body(new ZodValidationPipe(createStudentSchema)) body: CreateStudentInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.students.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.STUDENTS_UPDATE)
  update(
    @Param("id") studentId: string,
    @Body(new ZodValidationPipe(updateStudentSchema)) body: UpdateStudentInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.students.update(studentId, body, user, request);
  }
}
