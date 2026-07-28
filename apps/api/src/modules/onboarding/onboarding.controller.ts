import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { RequestUser } from "../../common/types/request-context";
import { OnboardingService } from "./onboarding.service";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// Carga masiva: misma autorización que crear un profesor/estudiante uno por uno
// (TEACHERS_CREATE / STUDENTS_CREATE ya gateadas a TENANT_ADMIN, PRINCIPAL,
// SECRETARY, SUPER_ADMIN), solo que procesa un CSV completo en un request.
@Controller("onboarding")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post("teachers/import")
  @Permissions(PERMISSIONS.TEACHERS_CREATE)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  importTeachers(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.onboarding.importTeachers(file, user, request);
  }

  @Post("students/import")
  @Permissions(PERMISSIONS.STUDENTS_CREATE)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  importStudents(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.onboarding.importStudents(file, user, request);
  }
}
