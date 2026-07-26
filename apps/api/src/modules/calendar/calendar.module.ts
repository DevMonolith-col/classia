import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AudienceCoreModule } from "../../common/audience/audience-core.module";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { ElectionsModule } from "../elections/elections.module";
import { EventsModule } from "../events/events.module";
import { HomeworkModule } from "../homework/homework.module";
import { PaymentsModule } from "../payments/payments.module";
import { CalendarController } from "./calendar.controller";
import { CalendarAggregationService } from "./calendar-aggregation.service";
import { CalendarFeedService } from "./calendar-feed.service";

// Importa EventsModule (que exporta EventsService) en vez de consultar Prisma por su cuenta:
// el requisito del feed es mostrar exactamente lo que vería el dueño del token llamando a la
// API, y eso solo se cumple reusando el mismo filtro de audiencia.
@Module({
  imports: [
    AuditCoreModule,
    AudienceCoreModule,
    EventsModule,
    HomeworkModule,
    PaymentsModule,
    ElectionsModule,
    JwtModule.register({}),
  ],
  controllers: [CalendarController],
  providers: [JwtAuthGuard, PermissionsGuard, CalendarFeedService, CalendarAggregationService],
})
export class CalendarModule {}
