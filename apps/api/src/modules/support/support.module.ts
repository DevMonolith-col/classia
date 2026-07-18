import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { AuditCoreModule } from "../../core/audit/audit-core.module"
import { SupportController } from "./support.controller"
import { SupportService } from "./support.service"
import { SupportGateway } from "./support.gateway"

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [SupportController],
  providers: [JwtAuthGuard, PermissionsGuard, SupportService, SupportGateway],
})
export class SupportModule {}
