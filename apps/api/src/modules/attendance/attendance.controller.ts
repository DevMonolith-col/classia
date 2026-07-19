import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  CreateSessionInput,
  ListSessionsQuery,
  SubmitRecordsInput,
  UpdateSessionInput,
  createSessionSchema,
  listSessionsQuerySchema,
  submitRecordsSchema,
  updateSessionSchema,
} from "./attendance.schemas";
import { AttendanceService } from "./attendance.service";

@Controller("attendance")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.DATOS_PERSONALES)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get("sessions")
  @Permissions(PERMISSIONS.ATTENDANCE_LIST)
  listSessions(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listSessionsQuerySchema)) query: ListSessionsQuery,
  ) {
    return this.attendance.listSessions(user, query);
  }

  @Get("sessions/:id")
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  findSession(@Param("id") sessionId: string, @CurrentUser() user: RequestUser) {
    return this.attendance.findSession(sessionId, user);
  }

  @Post("sessions")
  @Permissions(PERMISSIONS.ATTENDANCE_CREATE)
  createSession(
    @Body(new ZodValidationPipe(createSessionSchema)) body: CreateSessionInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.attendance.createOrGetSession(body, user, request);
  }

  @Patch("sessions/:id")
  @Permissions(PERMISSIONS.ATTENDANCE_UPDATE)
  updateSession(
    @Param("id") sessionId: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) body: UpdateSessionInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.attendance.updateSession(sessionId, body, user, request);
  }

  @Put("sessions/:id/records")
  @Permissions(PERMISSIONS.ATTENDANCE_UPDATE)
  submitRecords(
    @Param("id") sessionId: string,
    @Body(new ZodValidationPipe(submitRecordsSchema)) body: SubmitRecordsInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.attendance.submitRecords(sessionId, body, user, request);
  }
}
