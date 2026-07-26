import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AudienceCoreModule } from "../../common/audience/audience-core.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { HomeworkController } from "./homework.controller";
import { HomeworkService } from "./homework.service";

@Module({
  imports: [AuditCoreModule, AudienceCoreModule, JwtModule.register({})],
  controllers: [HomeworkController],
  providers: [JwtAuthGuard, PermissionsGuard, HomeworkService],
  // Lo consume CalendarModule para proyectar las fechas de entrega en el calendario agregado,
  // reusando su scoping por rol en vez de copiarlo.
  exports: [HomeworkService],
})
export class HomeworkModule {}
