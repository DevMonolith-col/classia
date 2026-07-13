import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-context";
import { BootstrapService } from "./bootstrap.service";

@Controller("app")
@UseGuards(JwtAuthGuard)
export class BootstrapController {
  constructor(private readonly bootstrap: BootstrapService) {}

  @Get("bootstrap")
  getBootstrap(@CurrentUser() user: RequestUser) {
    return this.bootstrap.getBootstrap(user);
  }
}
