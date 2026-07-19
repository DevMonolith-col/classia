import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { AuditCoreModule } from "../../core/audit/audit-core.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { AccessControlController } from "./access-control.controller"
import { AccessControlService } from "./access-control.service"

@Module({
  imports: [AuditCoreModule, NotificationsModule, JwtModule.register({})],
  controllers: [AccessControlController],
  providers: [JwtAuthGuard, AccessControlService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
