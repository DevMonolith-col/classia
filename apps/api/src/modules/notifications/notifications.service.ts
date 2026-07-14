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

    for (const userId of recipients) {
      try {
        const notification = await this.prisma.notification.create({
          data: {
            tenantId: params.tenantId,
            userId,
            eventType: params.eventType,
            title: params.title,
            body: params.body,
            entityType: params.entityType,
            entityId: params.entityId,
          },
          select: { id: true },
        });

        const emailEnabled = await this.isChannelEnabled(
          userId,
          params.eventType,
          NotificationChannel.EMAIL,
        );
        if (emailEnabled) {
          const delivery = await this.prisma.notificationDelivery.create({
            data: { notificationId: notification.id, channel: NotificationChannel.EMAIL },
            select: { id: true },
          });
          await this.queue.add(
            "dispatch",
            { deliveryId: delivery.id },
            {
              jobId: delivery.id,
              attempts: 5,
              backoff: { type: "exponential", delay: 2000 },
              removeOnComplete: true,
              removeOnFail: 100,
            },
          );
        }
      } catch (error) {
        this.logger.error(
          `No se pudo crear la notificación para ${userId}: ${(error as Error).message}`,
        );
      }
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

  private async isChannelEnabled(
    userId: string,
    eventType: NotificationEventType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_eventType_channel: { userId, eventType, channel } },
      select: { enabled: true },
    });
    return pref?.enabled ?? true; // por defecto activado (tabla dispersa)
  }
}
