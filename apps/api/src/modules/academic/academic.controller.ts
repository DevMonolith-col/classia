import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { AcademicService } from "./academic.service";
import {
  CreateAcademicYearInput,
  SetPeriodsInput,
  UpdateAcademicYearInput,
  createAcademicYearSchema,
  setPeriodsSchema,
  updateAcademicYearSchema,
} from "./academic.schemas";

// Gating por permisos existentes (audiencia correcta, sin tocar el permissions.ts
// compartido): SUBJECTS_CREATE = admin institucional; SUBJECTS_READ = admin + profesor.
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Get("academic-years")
  @Permissions(PERMISSIONS.SUBJECTS_READ)
  listYears(@CurrentUser() user: RequestUser, @Query("tenantId") tenantId?: string) {
    return this.academic.listYears(user, tenantId);
  }

  @Get("academic-years/:id")
  @Permissions(PERMISSIONS.SUBJECTS_READ)
  findYear(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.academic.findYear(id, user);
  }

  @Post("academic-years")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  createYear(
    @Body(new ZodValidationPipe(createAcademicYearSchema)) body: CreateAcademicYearInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.academic.createYear(body, user, req);
  }

  @Patch("academic-years/:id")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  updateYear(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAcademicYearSchema)) body: UpdateAcademicYearInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.academic.updateYear(id, body, user, req);
  }

  @Post("academic-years/:id/activate")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  activateYear(@Param("id") id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.academic.activateYear(id, user, req);
  }

  @Post("academic-years/:id/archive")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  archiveYear(@Param("id") id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.academic.archiveYear(id, user, req);
  }

  @Post("academic-years/:id/periods")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  setPeriods(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setPeriodsSchema)) body: SetPeriodsInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.academic.setPeriods(id, body, user, req);
  }

  @Post("academic-periods/:id/lock")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  lockPeriod(@Param("id") id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.academic.lockPeriod(id, true, user, req);
  }

  @Post("academic-periods/:id/unlock")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  unlockPeriod(@Param("id") id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.academic.lockPeriod(id, false, user, req);
  }
}
