import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto, @Query("tenant") tenant = "demo") {
    return this.auth.login(dto, tenant);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: any) {
    return this.auth.me(user.id);
  }
}
