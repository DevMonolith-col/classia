import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { ReportCardsController } from "./report-cards.controller";
import { ReportCardsService } from "./report-cards.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [ReportCardsController],
  providers: [JwtAuthGuard, PermissionsGuard, ReportCardsService],
  exports: [ReportCardsService],
})
export class ReportCardsModule {}
