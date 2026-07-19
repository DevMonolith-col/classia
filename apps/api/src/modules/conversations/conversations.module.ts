import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [AuditCoreModule, DataScopeModule, JwtModule.register({})],
  controllers: [ConversationsController],
  providers: [JwtAuthGuard, PermissionsGuard, ConversationsService],
})
export class ConversationsModule {}
