import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { SaveAnswerInput, saveAnswerSchema } from "./quiz-attempts.schemas";
import { QuizAttemptsService } from "./quiz-attempts.service";

@Controller("homework/:homeworkId/quiz")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuizAttemptsController {
  constructor(private readonly quizAttempts: QuizAttemptsService) {}

  @Get()
  @Permissions(PERMISSIONS.QUIZ_ATTEMPTS_READ)
  getQuiz(@Param("homeworkId") homeworkId: string, @CurrentUser() user: RequestUser) {
    return this.quizAttempts.getQuiz(homeworkId, user);
  }

  @Post("attempts")
  @Permissions(PERMISSIONS.QUIZ_ATTEMPTS_START)
  start(@Param("homeworkId") homeworkId: string, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.quizAttempts.start(homeworkId, user, request);
  }

  @Patch("attempts/:attemptId/answers")
  @Permissions(PERMISSIONS.QUIZ_ATTEMPTS_ANSWER)
  saveAnswer(
    @Param("homeworkId") homeworkId: string,
    @Param("attemptId") attemptId: string,
    @Body(new ZodValidationPipe(saveAnswerSchema)) body: SaveAnswerInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quizAttempts.saveAnswer(homeworkId, attemptId, body, user);
  }

  @Post("attempts/:attemptId/submit")
  @Permissions(PERMISSIONS.QUIZ_ATTEMPTS_SUBMIT)
  submit(
    @Param("homeworkId") homeworkId: string,
    @Param("attemptId") attemptId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.quizAttempts.submit(homeworkId, attemptId, user, request);
  }
}
