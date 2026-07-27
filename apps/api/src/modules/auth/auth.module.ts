import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { TenantContextModule } from "../../core/tenant-context/tenant-context.module";
import { AccessControlModule } from "../access-control/access-control.module";
import { EmailModule } from "../notifications/email/email.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ForgotPasswordThrottlerGuard } from "./forgot-password-throttler.guard";

@Module({
  imports: [
    AuditCoreModule,
    // Solo por el correo de restablecimiento de contraseña. Es EmailModule y no
    // NotificationsModule a propósito: ese último registra la cola de BullMQ.
    EmailModule,
    JwtModule.register({ global: true }),
    TenantContextModule,
    AccessControlModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ForgotPasswordThrottlerGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
