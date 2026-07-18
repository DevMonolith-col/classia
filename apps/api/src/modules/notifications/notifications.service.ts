import { randomUUID } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NotificationChannel, NotificationEventType } from "@prisma/client";
import { Queue } from "bullmq";
import { RequestUser } from "../../common/types/request-context";
import { PrismaService } from "../../core/prisma/prisma.service";
import { UpdatePreferenceInput } from "./notifications.schemas";

export const NOTIFICATIONS_QUEUE = "notifications";

type NotifyParams = {
  tenantId: string;
  eventType: NotificationEventType;
  recipientUserIds: string[];
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Crea una notificación in-app por cada destinatario y, si el usuario no ha
   * desactivado el canal de email, crea la entrega EMAIL y la encola. Un fallo
   * aquí nunca debe romper la acción de dominio que la disparó.
   */
  async notify(params: NotifyParams) {
    const recipients = [...new Set(params.recipientUserIds)].filter(Boolean);
    if (recipients.length === 0) return;

    // Todo en lote: antes era 1 query de preferencia + 1 create + 1 enqueue POR
    // usuario en serie (miles de queries en un comunicado a todo el colegio).
    // El try/catch envuelve todo: una falla al notificar nunca debe romper la
    // acción de dominio que la disparó.
    try {
      // Preferencias EMAIL de todos los destinatarios en una sola query. La tabla
      // es dispersa: sin fila = habilitado, así que solo importan los deshabilitados.
      const prefs = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: recipients }, eventType: params.eventType, channel: NotificationChannel.EMAIL },
        select: { userId: true, enabled: true },
      });
      const emailDisabled = new Set(prefs.filter((p) => !p.enabled).map((p) => p.userId));

      const notifRows = recipients.map((userId) => ({
        id: randomUUID(),
        tenantId: params.tenantId,
        userId,
        eventType: params.eventType,
        title: params.title,
        body: params.body,
        entityType: params.entityType,
        entityId: params.entityId,
      }));
      await this.prisma.notification.createMany({ data: notifRows });

      const deliveryRows = notifRows
        .filter((n) => !emailDisabled.has(n.userId))
        .map((n) => ({ id: randomUUID(), notificationId: n.id, channel: NotificationChannel.EMAIL }));

      if (deliveryRows.length > 0) {
        await this.prisma.notificationDelivery.createMany({ data: deliveryRows });
        await this.queue.addBulk(
          deliveryRows.map((d) => ({
            name: "dispatch",
            data: { deliveryId: d.id },
            opts: {
              jobId: d.id,
              attempts: 5,
              backoff: { type: "exponential" as const, delay: 2000 },
              removeOnComplete: true,
              removeOnFail: 100,
            },
          })),
        );
      }
    } catch (error) {
      this.logger.error(`No se pudieron crear las notificaciones: ${(error as Error).message}`);
    }
  }

  // ─── Centro in-app ────────────────────────────────────────────────────────────

  listForUser(actor: RequestUser) {
    return this.prisma.notification.findMany({
      where: { userId: actor.id, tenantId: actor.tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        eventType: true,
        title: true,
        body: true,
        entityType: true,
        entityId: true,
        isRead: true,
        createdAt: true,
      },
    });
  }

  async unreadCount(actor: RequestUser) {
    const count = await this.prisma.notification.count({
      where: { userId: actor.id, tenantId: actor.tenantId, isRead: false },
    });
    return { count };
  }

  async markRead(actor: RequestUser, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: actor.id },
      select: { id: true },
    });
    if (!notification) {
      throw new NotFoundException("Notificación no encontrada.");
    }
    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return { status: "ok" as const };
  }

  async markAllRead(actor: RequestUser) {
    await this.prisma.notification.updateMany({
      where: { userId: actor.id, tenantId: actor.tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { status: "ok" as const };
  }

  // ─── Preferencias ─────────────────────────────────────────────────────────────

  getPreferences(actor: RequestUser) {
    return this.prisma.notificationPreference.findMany({
      where: { userId: actor.id },
      select: { eventType: true, channel: true, enabled: true },
    });
  }

  async updatePreference(actor: RequestUser, input: UpdatePreferenceInput) {
    await this.prisma.notificationPreference.upsert({
      where: {
        userId_eventType_channel: {
          userId: actor.id,
          eventType: input.eventType,
          channel: input.channel,
        },
      },
      update: { enabled: input.enabled },
      create: {
        userId: actor.id,
        eventType: input.eventType,
        channel: input.channel,
        enabled: input.enabled,
      },
    });
    return { status: "ok" as const };
  }

}
