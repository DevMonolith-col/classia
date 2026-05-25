import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { GuardianService } from "./guardian.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@Controller("guardian")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("GUARDIAN", "TENANT_ADMIN", "SUPER_ADMIN")
export class GuardianController {
  constructor(private guardian: GuardianService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: any) {
    return this.guardian.getDashboard(user.id, user.tenantId);
  }

  @Get("children")
  children(@CurrentUser() user: any) {
    return this.guardian.getChildren(user.id, user.tenantId);
  }

  @Get("grades")
  grades(@CurrentUser() user: any, @Query("studentId") studentId?: string) {
    return this.guardian.getGrades(user.id, user.tenantId, studentId);
  }

  @Get("attendance")
  attendance(@CurrentUser() user: any, @Query("studentId") studentId?: string) {
    return this.guardian.getAttendance(user.id, user.tenantId, studentId);
  }

  @Get("homework")
  homework(@CurrentUser() user: any, @Query("studentId") studentId?: string) {
    return this.guardian.getHomework(user.id, user.tenantId, studentId);
  }

  @Get("messages")
  messages(@CurrentUser() user: any) {
    return this.guardian.getMessages(user.id, user.tenantId);
  }
}
