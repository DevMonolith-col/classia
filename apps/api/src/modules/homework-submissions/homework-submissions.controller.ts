import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
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
  GradeSubmissionInput,
  SubmitHomeworkInput,
  gradeSubmissionSchema,
  submitHomeworkSchema,
} from "./homework-submissions.schemas";
import { HomeworkSubmissionsService } from "./homework-submissions.service";

@Controller("homework/:homeworkId/submissions")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.DATOS_PERSONALES)
export class HomeworkSubmissionsController {
  constructor(private readonly submissions: HomeworkSubmissionsService) {}

  @Post()
  @Permissions(PERMISSIONS.HOMEWORK_SUBMISSIONS_CREATE)
  submit(
    @Param("homeworkId") homeworkId: string,
    @Body(new ZodValidationPipe(submitHomeworkSchema)) body: SubmitHomeworkInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.submissions.upsertMine(homeworkId, body, user, request);
  }

  @Get()
  @Permissions(PERMISSIONS.HOMEWORK_SUBMISSIONS_LIST)
  list(@Param("homeworkId") homeworkId: string, @CurrentUser() user: RequestUser) {
    return this.submissions.listForHomework(homeworkId, user);
  }

  @Get("me")
  @Permissions(PERMISSIONS.HOMEWORK_SUBMISSIONS_READ)
  findMine(@Param("homeworkId") homeworkId: string, @CurrentUser() user: RequestUser) {
    return this.submissions.findMine(homeworkId, user);
  }

  @Patch(":submissionId/grade")
  @Permissions(PERMISSIONS.HOMEWORK_SUBMISSIONS_GRADE)
  grade(
    @Param("homeworkId") homeworkId: string,
    @Param("submissionId") submissionId: string,
    @Body(new ZodValidationPipe(gradeSubmissionSchema)) body: GradeSubmissionInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.submissions.grade(homeworkId, submissionId, body, user, request);
  }
}
