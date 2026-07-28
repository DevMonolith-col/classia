import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { ForgotPasswordThrottlerGuard } from "./forgot-password-throttler.guard";
import { ResetPasswordThrottlerGuard } from "./reset-password-throttler.guard";
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshTokenInput,
  ImpersonateInput,
  ResetPasswordInput,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  impersonateSchema,
  resetPasswordSchema,
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
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: Request,
  ) {
    return this.auth.login(body, request);
  }

  // Más estricto que login (5/min contra 20): acá cada intento manda un correo, así que el
  // abuso no es solo adivinar credenciales sino usar el endpoint para bombardear una bandeja
  // ajena. Y a diferencia del login, nadie necesita pedir el enlace veinte veces por minuto.
  // Trackeado por email (no por IP): ver ForgotPasswordThrottlerGuard.
  @Post("forgot-password")
  @UseGuards(ForgotPasswordThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() request: Request,
  ) {
    return this.auth.forgotPassword(body, request);
  }

  // El límite también protege de probar enlaces al azar por fuerza bruta. Trackeado por token
  // (no por IP): es el segundo paso del mismo flujo que forgot-password, y dejarlo por IP
  // habría vuelto a bloquear a un colegio completando el onboarding en bloque desde la misma
  // red. Ver ResetPasswordThrottlerGuard.
  @Post("reset-password")
  @UseGuards(ResetPasswordThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() request: Request,
  ) {
    return this.auth.resetPassword(body, request);
  }

  // Con sesión abierta, pero igual limitado: el cuerpo lleva `currentPassword`, así que sin
  // tope este endpoint es un oráculo para adivinar la contraseña de la cuenta cuyo token ya
  // se tiene. Mismo límite que reset-password.
  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.auth.changePassword(user, body, request);
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
