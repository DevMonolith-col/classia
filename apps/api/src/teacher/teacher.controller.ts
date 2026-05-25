import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { TeacherService } from "./teacher.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CreateAttendanceDto } from "./dto/attendance.dto";
import { CreateHomeworkDto } from "./dto/homework.dto";
import { CreateMarkDto } from "./dto/mark.dto";

@Controller("teacher")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("TEACHER", "COORDINATOR", "PRINCIPAL", "TENANT_ADMIN", "SUPER_ADMIN")
export class TeacherController {
  constructor(private teacher: TeacherService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: any) {
    return this.teacher.getDashboard(user.id, user.tenantId);
  }

  @Get("schedule")
  schedule(@CurrentUser() user: any) {
    return this.teacher.getSchedule(user.id, user.tenantId);
  }

  @Get("groups")
  groups(@CurrentUser() user: any) {
    return this.teacher.getGroups(user.id, user.tenantId);
  }

  @Get("attendance")
  attendanceSessions(@CurrentUser() user: any, @Query("groupId") groupId?: string) {
    return this.teacher.getAttendanceSessions(user.id, user.tenantId, groupId);
  }

  @Post("attendance")
  recordAttendance(@CurrentUser() user: any, @Body() dto: CreateAttendanceDto) {
    return this.teacher.recordAttendance(user.id, user.tenantId, dto);
  }

  @Get("homework")
  homework(@CurrentUser() user: any) {
    return this.teacher.getHomework(user.id, user.tenantId);
  }

  @Post("homework")
  createHomework(@CurrentUser() user: any, @Body() dto: CreateHomeworkDto) {
    return this.teacher.createHomework(user.id, user.tenantId, dto);
  }

  @Get("marks")
  marks(
    @CurrentUser() user: any,
    @Query("groupId") groupId?: string,
    @Query("subjectId") subjectId?: string,
  ) {
    return this.teacher.getMarks(user.id, user.tenantId, groupId, subjectId);
  }

  @Post("marks")
  createMark(@CurrentUser() user: any, @Body() dto: CreateMarkDto) {
    return this.teacher.createMark(user.id, user.tenantId, dto);
  }
}
