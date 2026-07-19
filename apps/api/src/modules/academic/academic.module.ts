import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { AcademicController } from "./academic.controller";
import { AcademicService } from "./academic.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [AcademicController],
  providers: [JwtAuthGuard, PermissionsGuard, AcademicService],
  exports: [AcademicService],
})
export class AcademicModule {}
