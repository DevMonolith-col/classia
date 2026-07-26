import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AudienceCoreModule } from "../../common/audience/audience-core.module";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { StudentsController } from "./students.controller";
import { StudentsService } from "./students.service";

@Module({
  imports: [AuditCoreModule, AudienceCoreModule, DataScopeModule, JwtModule.register({})],
  controllers: [StudentsController],
  providers: [JwtAuthGuard, PermissionsGuard, StudentsService],
})
export class StudentsModule {}
