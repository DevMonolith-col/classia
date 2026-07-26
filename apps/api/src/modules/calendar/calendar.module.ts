import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AudienceCoreModule } from "../../common/audience/audience-core.module";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { EventsModule } from "../events/events.module";
import { CalendarController } from "./calendar.controller";
import { CalendarFeedService } from "./calendar-feed.service";

// Importa EventsModule (que exporta EventsService) en vez de consultar Prisma por su cuenta:
// el requisito del feed es mostrar exactamente lo que vería el dueño del token llamando a la
// API, y eso solo se cumple reusando el mismo filtro de audiencia.
@Module({
  imports: [AuditCoreModule, AudienceCoreModule, EventsModule, JwtModule.register({})],
  controllers: [CalendarController],
  providers: [JwtAuthGuard, PermissionsGuard, CalendarFeedService],
})
export class CalendarModule {}
