import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AudienceCoreModule } from "../../common/audience/audience-core.module";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { MarksModule } from "../marks/marks.module";
import { HomeworkSubmissionsController } from "./homework-submissions.controller";
import { HomeworkSubmissionsService } from "./homework-submissions.service";

@Module({
  // MarksModule porque la nota que nace al calificar se escribe por el writer único
  // (`MarksService.upsertMarkInTransaction()`), que centraliza el anclaje al año
  // académico, la auditoría sobre `Mark` y el aviso al alumno. Ver el skill
  // `calificaciones`.
  // StorageService no se importa: StorageModule es @Global. Se usa para firmar la URL de
  // descarga de la entrega y de la retroalimentación sin conceder FILES_READ a la familia.
  imports: [AuditCoreModule, AudienceCoreModule, DataScopeModule, JwtModule.register({}), MarksModule],
  controllers: [HomeworkSubmissionsController],
  providers: [JwtAuthGuard, PermissionsGuard, HomeworkSubmissionsService],
})
export class HomeworkSubmissionsModule {}
