import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AudienceCoreModule } from "../../common/audience/audience-core.module";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { EventReminderProcessor } from "./event-reminders.processor";
import { EVENT_REMINDERS_QUEUE, EventRemindersService } from "./event-reminders.service";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [
    AuditCoreModule,
    AudienceCoreModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: EVENT_REMINDERS_QUEUE }),
  ],
  controllers: [EventsController],
  providers: [
    JwtAuthGuard,
    PermissionsGuard,
    EventsService,
    EventRemindersService,
    EventReminderProcessor,
  ],
  // Lo consume CalendarModule para el feed ICS: el feed tiene que aplicar el mismo filtro de
  // audiencia que GET /events, no una copia suya.
  exports: [EventsService],
})
export class EventsModule {}
