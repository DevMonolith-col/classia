import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { QuizAttemptsController } from "./quiz-attempts.controller";
import { QuizAttemptsService } from "./quiz-attempts.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [QuizAttemptsController],
  providers: [JwtAuthGuard, PermissionsGuard, QuizAttemptsService],
})
export class QuizAttemptsModule {}
