import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { GuardiansController } from "./guardians.controller";
import { GuardiansService } from "./guardians.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [GuardiansController],
  providers: [JwtAuthGuard, PermissionsGuard, GuardiansService],
})
export class GuardiansModule {}
