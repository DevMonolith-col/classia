import { Logger, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { WsJwtGuard, verifyAndDecodeToken } from "../../common/guards/ws-jwt.guard";
import {
  MessageReceivedEvent,
  NOTIFICATION_EVENTS,
  type NotificationCreatedEvent,
} from "../notifications/notifications.events";

/**
 * Tiempo real de la mensajería del colegio (docs/planning/chat-tiempo-real.md, Fases 1-2).
 *
 * Namespace propio (`conversations`) y no el de soporte: son dos productos distintos con
 * audiencias distintas —soporte es B2B entre el colegio y Classia; esto es entre profesores y
 * familias— y compartir namespace obligaría a filtrar por rol en cada emisión.
 *
 * **Una sala por usuario, `user:{userId}`, y no por conversación.** El evento
 * `MESSAGE_RECEIVED` ya llega con `recipientUserIds` resuelto por `ConversationsService`, que
 * es quien aplicó el scoping de rol y de tenant. Emitir a la sala del usuario reusa esa
 * decisión en vez de repetirla; salas por hilo obligarían a suscribir y revalidar pertenencia
 * en cada apertura, más superficie de error para el mismo resultado. El aislamiento entre
 * colegios sale gratis: un `userId` pertenece a un solo tenant.
 *
 * Los mensajes se siguen **enviando por HTTP POST**; el socket es solo para **recibir**. El
 * POST ya tiene guards, Zod, auditoría y cobertura e2e, y así el chat degrada a funcional
 * —sin push— si el WebSocket se cae.
 */
@WebSocketGateway({ namespace: "conversations" })
@UseGuards(WsJwtGuard)
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ConversationsGateway.name);

  // Un socket no recibe un 401 por sí solo: sin esto, un cliente se queda conectado con un
  // token vencido indefinidamente. Mismo patrón que SupportGateway.
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      client.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      client.data.user = await verifyAndDecodeToken(token, this.jwt, this.config);
    } catch {
      // Se verifica al conectar y no solo en el primer mensaje: si no, cualquiera abre
      // sockets anónimos y consume memoria del servidor sin credenciales.
      client.disconnect(true);
      return;
    }

    const userId = client.data.user?.id;
    if (!userId) {
      client.disconnect(true);
      return;
    }

    void client.join(this.userRoom(userId));
    this.scheduleExpiry(client, token);
  }

  handleDisconnect(client: Socket) {
    const timer = this.expiryTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(client.id);
    }
  }

  /**
   * Empuja el mensaje a cada destinatario. Es lo que hace que deje de hacer falta el F5.
   *
   * El mensaje viaja **dentro del evento** (ver `MessageReceivedEvent.message`) en vez de
   * consultarse acá: un `@OnEvent` puede resolverse fuera del contexto de tenant del request
   * que lo emitió, y con RLS forzado esa consulta devolvería cero filas sin error — el mensaje
   * simplemente no llegaría a nadie y no habría nada en los logs.
   */
  @OnEvent(NOTIFICATION_EVENTS.MESSAGE_RECEIVED)
  handleMessageReceived(event: MessageReceivedEvent) {
    for (const userId of event.recipientUserIds) {
      this.server.to(this.userRoom(userId)).emit("message:new", {
        conversationId: event.conversationId,
        message: event.message,
      });
    }
  }

  /**
   * Avisa que el contador de no leídos de esas personas cambió, sin decir de qué.
   *
   * El payload es deliberadamente vacío: el cliente vuelve a pedir el contador a
   * `/notifications/unread-count`, que ya aplica el scoping del actor. Mandar el número por
   * socket obligaría a recalcularlo por destinatario acá y a mantener dos fuentes de verdad
   * para el mismo dato.
   *
   * Cubre todas las notificaciones —nota, tarea, inasistencia, comunicado, evento, mensaje—
   * y no solo el chat, porque cuelga de `NotificationsService#notify`, por donde pasan todas.
   */
  @OnEvent(NOTIFICATION_EVENTS.NOTIFICATION_CREATED)
  handleNotificationCreated(event: NotificationCreatedEvent) {
    for (const userId of event.recipientUserIds) {
      this.server.to(this.userRoom(userId)).emit("notification:new");
    }
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private scheduleExpiry(client: Socket, token: string) {
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return;

    const msUntilExpiry = decoded.exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      client.disconnect(true);
      return;
    }

    const timer = setTimeout(() => {
      // El cliente escucha esto, refresca el token y reconecta
      // (apps/web/lib/socket.ts#attachTokenRefresh).
      client.emit("token_expired");
      client.disconnect(true);
    }, msUntilExpiry);

    this.expiryTimers.set(client.id, timer);
  }
}
