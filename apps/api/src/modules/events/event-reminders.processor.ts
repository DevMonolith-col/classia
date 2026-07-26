import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Job } from "bullmq";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import {
  type CalendarEventNotification,
  NOTIFICATION_EVENTS,
} from "../notifications/notifications.events";
import { EVENT_REMINDERS_QUEUE, type EventReminderJobData } from "./event-reminders.service";

/**
 * Dispara el recordatorio de un evento cuando llega su momento.
 *
 * Corre **sin request**, así que `TenantRlsContextInterceptor` no setea nada: sin el
 * `runWithTenant` de abajo la consulta devuelve cero filas y el recordatorio no se manda,
 * sin error y sin rastro en los logs. Es el mismo patrón de los otros cuatro processors
 * (notifications, documents, reports, access-session-expiry).
 */
@Processor(EVENT_REMINDERS_QUEUE)
export class EventReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(EventReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<EventReminderJobData>) {
    const { eventId, tenantId } = job.data;

    if (!tenantId) {
      // Encolar sin tenantId no falla solo: procesaría cero filas para siempre. Mejor ruidoso.
      this.logger.error(`Recordatorio del evento ${eventId} encolado sin tenantId — se descarta.`);
      return { sent: false };
    }

    return this.tenantRlsContext.runWithTenant(tenantId, async () => {
      const event = await this.prisma.event.findFirst({
        // `deletedAt: null` importa: el soft-delete no borra el job de Redis si el borrado
        // ocurrió por un camino que no pasó por EventRemindersService#cancel.
        where: { id: eventId, deletedAt: null },
        select: {
          id: true,
          tenantId: true,
          title: true,
          startsAt: true,
          allDay: true,
          location: true,
          targetRole: true,
          groupId: true,
        },
      });

      if (!event) {
        this.logger.log(`Evento ${eventId} ya no existe o fue borrado — no se manda recordatorio.`);
        return { sent: false };
      }

      this.events.emit(NOTIFICATION_EVENTS.EVENT_REMINDER, {
        tenantId: event.tenantId,
        eventId: event.id,
        title: event.title,
        startsAt: event.startsAt,
        allDay: event.allDay,
        location: event.location,
        targetRole: event.targetRole,
        // Null a propósito: en el recordatorio, a quien lo creó también hay que recordárselo.
        authorId: null,
        groupId: event.groupId,
      } satisfies CalendarEventNotification);

      return { sent: true };
    });
  }
}
