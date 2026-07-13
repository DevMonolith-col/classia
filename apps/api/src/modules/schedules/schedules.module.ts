import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { SchedulesController } from "./schedules.controller";
import { SchedulesService } from "./schedules.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [SchedulesController],
  providers: [JwtAuthGuard, PermissionsGuard, SchedulesService],
})
export class SchedulesModule {}
