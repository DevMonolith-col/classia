import { Controller, Get, UseGuards, Req, ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { HealthService } from "./health.service";
import { PlatformRoute } from "../../common/decorators/platform-route.decorator";

// Ruta de plataforma (ver platform-route.decorator.ts). Estado del sistema.
@PlatformRoute()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check() {
    return this.health.check();
  }

  @Get("stats")
  @UseGuards(JwtAuthGuard)
  getStats(@Req() req: any) {
    if (req.user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("No autorizado");
    }
    return this.health.getStats();
  }
}
