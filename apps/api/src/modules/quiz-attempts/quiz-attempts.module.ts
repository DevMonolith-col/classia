import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { MarksModule } from "../marks/marks.module";
import { QuizAttemptsController } from "./quiz-attempts.controller";
import { QuizAttemptsService } from "./quiz-attempts.service";

@Module({
  // MarksModule porque la nota que nace al autocalificar se escribe por el writer
  // único (`MarksService.upsertMark()`), que centraliza el anclaje al año académico,
  // la auditoría sobre `Mark` y el aviso al alumno. Ver el skill `calificaciones`.
  imports: [AuditCoreModule, DataScopeModule, JwtModule.register({}), MarksModule],
  controllers: [QuizAttemptsController],
  providers: [JwtAuthGuard, PermissionsGuard, QuizAttemptsService],
})
export class QuizAttemptsModule {}
