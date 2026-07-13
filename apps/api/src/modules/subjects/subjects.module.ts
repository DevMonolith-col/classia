import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { SubjectsController } from "./subjects.controller";
import { SubjectsService } from "./subjects.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [SubjectsController],
  providers: [JwtAuthGuard, PermissionsGuard, SubjectsService],
})
export class SubjectsModule {}
