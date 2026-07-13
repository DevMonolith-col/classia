import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { HomeworkController } from "./homework.controller";
import { HomeworkService } from "./homework.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [HomeworkController],
  providers: [JwtAuthGuard, PermissionsGuard, HomeworkService],
})
export class HomeworkModule {}
