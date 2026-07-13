import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [QuestionsController],
  providers: [JwtAuthGuard, PermissionsGuard, QuestionsService],
})
export class QuestionsModule {}
