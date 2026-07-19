import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { GradingController } from "./grading.controller";
import { GradingService } from "./grading.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [GradingController],
  providers: [JwtAuthGuard, PermissionsGuard, GradingService],
  exports: [GradingService],
})
export class GradingModule {}
