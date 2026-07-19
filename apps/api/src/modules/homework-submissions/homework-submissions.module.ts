import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { HomeworkSubmissionsController } from "./homework-submissions.controller";
import { HomeworkSubmissionsService } from "./homework-submissions.service";

@Module({
  imports: [AuditCoreModule, DataScopeModule, JwtModule.register({})],
  controllers: [HomeworkSubmissionsController],
  providers: [JwtAuthGuard, PermissionsGuard, HomeworkSubmissionsService],
})
export class HomeworkSubmissionsModule {}
