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
  CreateHomeworkInput,
  ListHomeworkQuery,
  UpdateHomeworkInput,
  createHomeworkSchema,
  listHomeworkQuerySchema,
  updateHomeworkSchema,
} from "./homework.schemas";
import { HomeworkService } from "./homework.service";

@Controller("homework")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Get()
  @Permissions(PERMISSIONS.HOMEWORK_LIST)
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listHomeworkQuerySchema)) query: ListHomeworkQuery,
  ) {
    return this.homework.list(user, query);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.HOMEWORK_READ)
  findOne(@Param("id") homeworkId: string, @CurrentUser() user: RequestUser) {
    return this.homework.findOne(homeworkId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.HOMEWORK_CREATE)
  create(
    @Body(new ZodValidationPipe(createHomeworkSchema)) body: CreateHomeworkInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.homework.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.HOMEWORK_UPDATE)
  update(
    @Param("id") homeworkId: string,
    @Body(new ZodValidationPipe(updateHomeworkSchema)) body: UpdateHomeworkInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.homework.update(homeworkId, body, user, request);
  }
}
