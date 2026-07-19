import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { MarksController } from "./marks.controller";
import { MarksService } from "./marks.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [MarksController],
  providers: [JwtAuthGuard, PermissionsGuard, MarksService],
  // Exportado para que otros módulos (homework-submissions, quiz-attempts)
  // puedan enrutar sus escrituras de Mark a través de upsertMark() en vez de
  // escribir Prisma directo. Ver contrato en asignaciones-calificacion-en-linea.md §2.
  exports: [MarksService],
})
export class MarksModule {}
