import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type EmailMessage = { to: string; subject: string; html: string };
// `permanent` marca un fallo que no tiene sentido reintentar (4xx de Resend salvo
// 429): email inválido, dominio no verificado, etc. Los transitorios (5xx, 429,
// red) se dejan reintentar por la cola.
export type EmailResult = { status: "sent" | "skipped" | "failed"; error?: string; permanent?: boolean };

/**
 * Abstracción de envío de email. Degrada con elegancia: con EMAIL_PROVIDER=disabled
 * registra el correo en logs y devuelve "skipped" (la entrega queda SKIPPED). Con
 * "resend" envía de verdad vía la API REST de Resend (sin SDK, solo fetch).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  // Test de conexión para el panel de SuperAdmin: no manda ningún correo, solo confirma que el
  // proveedor activo está bien configurado. Con "disabled" o sin API key devuelve ok:false en
  // vez de reventar — una config vacía es un resultado válido del test, no un error 500.
  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    const provider = this.config.get<string>("email.provider") ?? "disabled";

    if (provider !== "resend") {
      return {
        ok: false,
        message: `El envío de correo está deshabilitado (EMAIL_PROVIDER=${provider}). Configura EMAIL_PROVIDER=resend y RESEND_API_KEY en el servidor.`,
      };
    }

    const apiKey = this.config.get<string>("email.resendApiKey");
    if (!apiKey) {
      return { ok: false, message: "Falta RESEND_API_KEY en el servidor." };
    }

    try {
      // Endpoint de solo lectura: confirma que la API key autentica sin enviar ningún correo.
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (res.ok) {
        return { ok: true, message: "Conexión con Resend verificada correctamente." };
      }

      const text = await res.text();
      return { ok: false, message: `Resend respondió ${res.status}: ${text.slice(0, 200)}` };
    } catch (error) {
      return { ok: false, message: `No se pudo contactar a Resend: ${(error as Error).message}` };
    }
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const provider = this.config.get<string>("email.provider") ?? "disabled";

    if (provider === "resend") {
      return this.sendViaResend(message);
    }

    // disabled (o desconocido): no se envía nada, solo se deja rastro.
    this.logger.log(
      `[email:${provider}] (no enviado) Para: ${message.to} · Asunto: ${message.subject}`,
    );
    return { status: "skipped", error: `email provider '${provider}'` };
  }

  private async sendViaResend(message: EmailMessage): Promise<EmailResult> {
    const apiKey = this.config.get<string>("email.resendApiKey");
    const from = this.config.get<string>("email.from") ?? "notificaciones@classia.com.co";

    if (!apiKey) {
      this.logger.warn("EMAIL_PROVIDER=resend pero falta RESEND_API_KEY; se omite el envío.");
      return { status: "skipped", error: "RESEND_API_KEY no configurada" };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        // 4xx (salvo 429 rate-limit) = fallo permanente: reintentar no ayuda.
        const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
        return { status: "failed", error: `resend ${res.status}: ${text.slice(0, 200)}`, permanent };
      }
      return { status: "sent" };
    } catch (error) {
      // Fallo de red/transitorio: se deja reintentar.
      return { status: "failed", error: (error as Error).message };
    }
  }
}
