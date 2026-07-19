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
  CreateScheduleInput,
  ListSchedulesQuery,
  UpdateScheduleInput,
  createScheduleSchema,
  listSchedulesQuerySchema,
  updateScheduleSchema,
} from "./schedules.schemas";
import { SchedulesService } from "./schedules.service";

@Controller("schedules")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.OPERATIVO)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @Permissions(PERMISSIONS.SCHEDULES_LIST)
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listSchedulesQuerySchema)) query: ListSchedulesQuery,
  ) {
    return this.schedules.list(user, query);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.SCHEDULES_READ)
  findOne(@Param("id") scheduleId: string, @CurrentUser() user: RequestUser) {
    return this.schedules.findOne(scheduleId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.SCHEDULES_CREATE)
  create(
    @Body(new ZodValidationPipe(createScheduleSchema)) body: CreateScheduleInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.schedules.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.SCHEDULES_UPDATE)
  update(
    @Param("id") scheduleId: string,
    @Body(new ZodValidationPipe(updateScheduleSchema)) body: UpdateScheduleInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.schedules.update(scheduleId, body, user, request);
  }
}
