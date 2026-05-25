import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("TENANT_ADMIN", "PRINCIPAL", "SUPER_ADMIN")
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: any) {
    return this.admin.getDashboard(user.tenantId);
  }

  @Get("students")
  students(
    @CurrentUser() user: any,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.admin.getStudents(user.tenantId, +page, +limit);
  }

  @Get("teachers")
  teachers(@CurrentUser() user: any) {
    return this.admin.getTeachers(user.tenantId);
  }

  @Get("courses")
  courses(@CurrentUser() user: any) {
    return this.admin.getCourses(user.tenantId);
  }

  @Get("messages")
  messages(
    @CurrentUser() user: any,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.admin.getMessages(user.tenantId, +page, +limit);
  }

  @Get("announcements")
  announcements(@CurrentUser() user: any) {
    return this.admin.getAnnouncements(user.tenantId);
  }
}
