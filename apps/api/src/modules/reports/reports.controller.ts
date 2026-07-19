import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common"
import { Request } from "express"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { Permissions } from "../../common/decorators/permissions.decorator"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { PERMISSIONS } from "../../common/permissions/permissions"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { RequestUser } from "../../common/types/request-context"
import { ReportsDataScopeGuard } from "./reports-data-scope.guard"
import { ReportsService } from "./reports.service"
import {
  CreateScheduleInput,
  GenerateReportInput,
  PreviewReportInput,
  ToggleScheduleInput,
  UpdateScheduleInput,
  createScheduleSchema,
  generateReportSchema,
  previewReportSchema,
  toggleScheduleSchema,
  updateScheduleSchema,
} from "./reports.schemas"

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSIONS.REPORTS_MANAGE)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post("reports")
  @UseGuards(ReportsDataScopeGuard)
  generate(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(generateReportSchema)) data: GenerateReportInput) {
    return this.reports.generate(user, data)
  }

  @Post("reports/preview")
  @UseGuards(ReportsDataScopeGuard)
  preview(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(previewReportSchema)) data: PreviewReportInput) {
    return this.reports.preview(user, data)
  }

  @Get("reports")
  list(@CurrentUser() user: RequestUser) {
    return this.reports.list(user)
  }

  @Get("reports/:id/status")
  getStatus(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.reports.getStatus(id, user)
  }

  @Post("report-schedules")
  @UseGuards(ReportsDataScopeGuard)
  createSchedule(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(createScheduleSchema)) data: CreateScheduleInput,
  ) {
    return this.reports.createSchedule(user, data, request)
  }

  @Get("report-schedules")
  listSchedules(@CurrentUser() user: RequestUser) {
    return this.reports.listSchedules(user)
  }

  @Patch("report-schedules/:id/toggle")
  toggleSchedule(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(toggleScheduleSchema)) body: ToggleScheduleInput,
  ) {
    return this.reports.toggleSchedule(id, user, body.active)
  }

  @Patch("report-schedules/:id")
  updateSchedule(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(updateScheduleSchema)) data: UpdateScheduleInput,
  ) {
    return this.reports.updateSchedule(id, user, data, request)
  }

  @Delete("report-schedules/:id")
  deleteSchedule(@Param("id") id: string, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.reports.deleteSchedule(id, user, request)
  }
}
