import { Controller, Get, Put, Body, UseGuards, ForbiddenException, Req } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { updateSettingsSchema, UpdateSettingsDto } from "./settings.schemas";

@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}
