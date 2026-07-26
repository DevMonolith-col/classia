import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AudienceCoreModule } from "../../common/audience/audience-core.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [AuditCoreModule, AudienceCoreModule, DataScopeModule, JwtModule.register({})],
  controllers: [ConversationsController],
  providers: [JwtAuthGuard, PermissionsGuard, ConversationsService, ConversationsGateway],
})
export class ConversationsModule {}
