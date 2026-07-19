import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  LoginInput,
  RefreshTokenInput,
  ImpersonateInput,
  loginSchema,
  refreshTokenSchema,
  impersonateSchema,
} from "./auth.schemas";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Rate-limit por IP contra fuerza bruta de contraseñas. 20/min (no 10, como
  // en verify) porque un IP compartido (red del colegio) puede tener varios
  // usuarios legítimos iniciando sesión en la misma ventana; un ataque real
  // intenta miles de contraseñas por minuto, así que sigue siendo efectivo.
  @Post("login")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: Request,
  ) {
    return this.auth.login(body, request);
  }

  @Post("refresh")
  refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput,
    @Req() request: Request,
  ) {
    return this.auth.refresh(body, request);
  }

  @Post("logout")
  logout(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput,
    @Req() request: Request,
  ) {
    return this.auth.logout(body, request);
  }

  @Post("impersonate")
  @UseGuards(JwtAuthGuard)
  impersonate(
    @Body(new ZodValidationPipe(impersonateSchema)) body: ImpersonateInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.auth.impersonate(body, user, request);
  }

  @Post("exit-impersonation")
  exitImpersonation(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput,
    @Req() request: Request,
  ) {
    return this.auth.exitImpersonation(body, request);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return {
      user,
    };
  }
}
