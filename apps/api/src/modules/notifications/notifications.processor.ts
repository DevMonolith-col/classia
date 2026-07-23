import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationDeliveryStatus } from "@prisma/client";
import { Job } from "bullmq";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import { EmailService } from "./email/email.service";
import { NOTIFICATIONS_QUEUE } from "./notifications.service";

// El título/cuerpo de la notificación pueden ser contenido escrito por otro
// usuario (p. ej. el preview de un mensaje). Sin escapar, un usuario podía
// inyectar HTML/enlaces de phishing en un correo enviado desde el dominio del
// colegio a la bandeja de la víctima.
function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly tenantRlsContext: TenantRlsContextService,
  ) {
    super();
  }

  // Ver reports.processor.ts: los jobs de BullMQ corren fuera de cualquier
  // request HTTP, así que el tenantId viaja en job.data desde que se encola.
  async process(job: Job<{ deliveryId: string; tenantId: string }>) {
    return this.tenantRlsContext.runWithTenant(job.data.tenantId, () => this.processDelivery(job));
  }

  private async processDelivery(job: Job<{ deliveryId: string; tenantId: string }>) {
    const { deliveryId } = job.data;

    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        status: true,
        notification: {
          select: { userId: true, title: true, body: true, entityType: true, entityId: true },
        },
      },
    });
    if (!delivery || delivery.status === NotificationDeliveryStatus.SENT) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: delivery.notification.userId },
      select: { email: true, firstName: true },
    });
    if (!user) {
      await this.mark(deliveryId, NotificationDeliveryStatus.FAILED, "usuario no encontrado");
      return;
    }

    const webUrl = this.config.get<string>("email.webUrl") ?? "http://localhost:3000";
    const result = await this.email.send({
      to: user.email,
      subject: delivery.notification.title,
      html:
        `<p>Hola ${escapeHtml(user.firstName)},</p>` +
        `<p><strong>${escapeHtml(delivery.notification.title)}</strong></p>` +
        `<p>${escapeHtml(delivery.notification.body)}</p>` +
        `<p><a href="${escapeHtml(webUrl)}">Ver en Classia</a></p>`,
    });

    if (result.status === "sent") {
      await this.mark(deliveryId, NotificationDeliveryStatus.SENT);
    } else if (result.status === "skipped") {
      await this.mark(deliveryId, NotificationDeliveryStatus.SKIPPED, result.error);
    } else {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          error: result.error ?? null,
          attempts: { increment: 1 },
        },
      });
      // Fallo permanente (4xx de Resend salvo 429): no relanzar, reintentar no
      // ayuda y solo quemaría los 5 intentos con backoff. Los transitorios sí.
      if (result.permanent) return;
      throw new Error(result.error ?? "email failed"); // que BullMQ reintente
    }
  }

  private async mark(id: string, status: NotificationDeliveryStatus, error?: string) {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        status,
        error: error ?? null,
        sentAt: status === NotificationDeliveryStatus.SENT ? new Date() : null,
      },
    });
  }
}
