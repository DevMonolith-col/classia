import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { TenantContextModule } from "../../core/tenant-context/tenant-context.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({}), TenantContextModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
