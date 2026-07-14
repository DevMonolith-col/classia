import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { AnnouncementsController } from "./announcements.controller";
import { AnnouncementsService } from "./announcements.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [AnnouncementsController],
  providers: [JwtAuthGuard, PermissionsGuard, AnnouncementsService],
})
export class AnnouncementsModule {}
