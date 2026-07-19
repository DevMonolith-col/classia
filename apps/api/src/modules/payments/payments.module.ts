import { Module } from "@nestjs/common"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { AuditCoreModule } from "../../core/audit/audit-core.module"
import { PaymentsController } from "./payments.controller"
import { PaymentsService } from "./payments.service"

@Module({
  imports: [AuditCoreModule],
  controllers: [PaymentsController],
  providers: [JwtAuthGuard, PermissionsGuard, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
