import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [EventsController],
  providers: [JwtAuthGuard, PermissionsGuard, EventsService],
})
export class EventsModule {}
