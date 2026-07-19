import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { TenantContextModule } from "../../core/tenant-context/tenant-context.module";
import { AccessControlModule } from "../access-control/access-control.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({ global: true }), TenantContextModule, AccessControlModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
