import { Module } from "@nestjs/common"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { AuditCoreModule } from "../../core/audit/audit-core.module"
import { ElectionsController } from "./elections.controller"
import { ElectionsService } from "./elections.service"

@Module({
  imports: [AuditCoreModule],
  controllers: [ElectionsController],
  providers: [JwtAuthGuard, PermissionsGuard, ElectionsService],
})
export class ElectionsModule {}
