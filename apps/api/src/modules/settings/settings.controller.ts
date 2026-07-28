import { Controller, Get, Post, Put, Body, UseGuards, ForbiddenException, Req } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { AccessScope } from "@prisma/client";
import { DataScope } from "../../common/decorators/data-scope.decorator";
import { DataScopeGuard } from "../../common/guards/data-scope.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { EmailService } from "../notifications/email/email.service";
import { updateSettingsSchema, UpdateSettingsDto } from "./settings.schemas";
import { PlatformRoute } from "../../common/decorators/platform-route.decorator";

// Ruta de plataforma (ver platform-route.decorator.ts). Configuración global de Classia (system_settings), no de un colegio.
@PlatformRoute()
@Controller("settings")
@UseGuards(JwtAuthGuard, DataScopeGuard)
@DataScope(AccessScope.OPERATIVO)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly email: EmailService,
  ) {}

  @Get()
  async getSettings(@Req() req: any) {
    if (req.user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Solo el super administrador puede ver la configuración global");
    }
    return this.settingsService.getSettings();
  }

  @Put()
  async updateSettings(
    @Req() req: any,
    @Body(new ZodValidationPipe(updateSettingsSchema)) data: UpdateSettingsDto
  ) {
    if (req.user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Solo el super administrador puede modificar la configuración global");
    }
    return this.settingsService.updateSettings(data);
  }

  @Post("smtp-test")
  async testSmtp(@Req() req: any) {
    if (req.user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Solo el super administrador puede probar el correo");
    }
    return this.email.verifyConnection();
  }
}
