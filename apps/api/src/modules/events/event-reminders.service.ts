import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { buildJobId } from "../../core/queue/job-id";

export const EVENT_REMINDERS_QUEUE = "event-reminders";

export type EventReminderJobData = {
  eventId: string;
  /**
   * Obligatorio. Un processor corre sin request, así que nadie le setea `app.tenant_id`:
   * encolar sin esto no falla, procesa cero filas y el recordatorio no se manda nunca
   * (docs/planning/calendario.md §7.7).
   */
  tenantId: string;
};

/**
 * Agendado de los recordatorios de eventos (§9.5: la antelación es por evento, no fija).
 *
 * Lo que hace que esto funcione o falle en silencio son tres cosas, y ninguna es evidente:
 *
 *  1. **El `jobId` pasa por `buildJobId`.** BullMQ rechaza `:` en un jobId personalizado y no
 *     avisa donde uno mira: `reports.service.ts` construía el suyo con `:` y por eso nunca
 *     llegó a programar un solo reporte recurrente (commit `41d86f5`).
 *  2. **Reagendar exige borrar primero.** El jobId es estable por evento, y BullMQ **ignora**
 *     un `add()` con un jobId que ya existe en vez de reemplazarlo. Sin el `remove()` previo,
 *     mover un evento del martes al viernes deja vivo el recordatorio del martes y el usuario
 *     recibe el aviso el día equivocado — sin ningún error de por medio.
 *  3. **El `tenantId` viaja en `job.data`**, ver EventReminderJobData.
 */
@Injectable()
export class EventRemindersService {
  private readonly logger = new Logger(EventRemindersService.name);

  constructor(@InjectQueue(EVENT_REMINDERS_QUEUE) private readonly queue: Queue) {}

  /**
   * Deja el recordatorio de este evento en el estado que corresponda: lo (re)agenda si tiene
   * antelación configurada y todavía no pasó, y lo cancela en cualquier otro caso.
   *
   * Es idempotente a propósito — se llama igual desde create y desde update, y llamarlo dos
   * veces con los mismos datos deja lo mismo.
   */
  async sync(event: {
    id: string;
    tenantId: string;
    startsAt: Date;
    reminderMinutesBefore: number | null;
    deletedAt?: Date | null;
  }) {
    // Siempre se borra primero, incluso cuando después se vuelve a agendar: ver el punto 2.
    await this.cancel(event.id);

    if (event.deletedAt || event.reminderMinutesBefore === null) return;

    const fireAt = event.startsAt.getTime() - event.reminderMinutesBefore * 60 * 1000;
    const delay = fireAt - Date.now();

    // Un recordatorio cuyo momento ya pasó no se manda: avisar "falta un día" cuando el evento
    // fue anteayer es peor que no avisar. Pasa al crear un evento pasado o al bajarle la
    // antelación a uno inminente.
    if (delay <= 0) return;

    await this.queue.add(
      "remind",
      { eventId: event.id, tenantId: event.tenantId } satisfies EventReminderJobData,
      {
        jobId: this.jobId(event.id),
        delay,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async cancel(eventId: string) {
    // `remove()` sobre un job inexistente no es un error, pero si Redis está caído sí tira —
    // y no queremos que eso rompa el guardado del evento. El recordatorio es accesorio.
    await this.queue.remove(this.jobId(eventId)).catch((error: Error) => {
      this.logger.warn(`No se pudo cancelar el recordatorio del evento ${eventId}: ${error.message}`);
    });
  }

  private jobId(eventId: string) {
    return buildJobId("event-reminder", eventId);
  }
}
