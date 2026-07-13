import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  CreateQuestionInput,
  UpdateQuestionInput,
  createQuestionSchema,
  updateQuestionSchema,
} from "./questions.schemas";
import { QuestionsService } from "./questions.service";

@Controller("homework/:homeworkId/questions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  @Permissions(PERMISSIONS.QUESTIONS_LIST)
  list(@Param("homeworkId") homeworkId: string, @CurrentUser() user: RequestUser) {
    return this.questions.list(homeworkId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.QUESTIONS_CREATE)
  create(
    @Param("homeworkId") homeworkId: string,
    @Body(new ZodValidationPipe(createQuestionSchema)) body: CreateQuestionInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.questions.create(homeworkId, body, user, request);
  }

  @Patch(":questionId")
  @Permissions(PERMISSIONS.QUESTIONS_UPDATE)
  update(
    @Param("questionId") questionId: string,
    @Body(new ZodValidationPipe(updateQuestionSchema)) body: UpdateQuestionInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.questions.update(questionId, body, user, request);
  }

  @Delete(":questionId")
  @Permissions(PERMISSIONS.QUESTIONS_DELETE)
  delete(@Param("questionId") questionId: string, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.questions.delete(questionId, user, request);
  }
}
