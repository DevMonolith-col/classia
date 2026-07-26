import { Logger, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { WsJwtGuard, verifyAndDecodeToken } from "../../common/guards/ws-jwt.guard";
import { RequestUser } from "../../common/types/request-context";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import { ConversationsService } from "./conversations.service";
import { PresenceService } from "./presence.service";
import {
  type ConversationReadEvent,
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
    private readonly conversations: ConversationsService,
    private readonly tenantRlsContext: TenantRlsContextService,
    private readonly presence: PresenceService,
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

    const becameOnline = await this.presence.connect(client.data.user.tenantId, userId);
    if (becameOnline) await this.broadcastPresence(client.data.user, userId, true);
  }

  async handleDisconnect(client: Socket) {
    const timer = this.expiryTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(client.id);
    }

    const actor = client.data.user as RequestUser | undefined;
    if (!actor?.id) return;

    // Cuántos sockets le quedan a esta persona: cerrar una pestaña no la desconecta.
    const sockets = await this.server.in(this.userRoom(actor.id)).fetchSockets();
    const remaining = sockets.filter((socket) => socket.id !== client.id).length;

    const wentOffline = await this.presence.disconnect(actor.tenantId, actor.id, remaining);
    if (wentOffline) await this.broadcastPresence(actor, actor.id, false);
  }

  /**
   * Latido del cliente. Sin esto, quien pierde la red o cierra la laptop queda "en línea" para
   * siempre: el TTL del heartbeat es lo único que lo apaga.
   */
  @SubscribeMessage("presence:heartbeat")
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const actor = client.data.user as RequestUser | undefined;
    if (!actor?.id) return;
    await this.presence.touch(actor.tenantId, actor.id);
  }

  /**
   * Avisa del cambio de presencia **solo a quienes hablan con esta persona**, no a todo el
   * colegio: en un colegio de mil personas, avisarle a todos por cada conexión es una tormenta
   * de mensajes por nada.
   */
  private async broadcastPresence(actor: RequestUser, userId: string, online: boolean) {
    const contacts = await this.tenantRlsContext.runWithTenant(actor.tenantId, () =>
      this.conversations.resolveConversationPartnerIds(actor),
    );

    for (const contactId of contacts) {
      this.server.to(this.userRoom(contactId)).emit("presence:changed", {
        userId,
        online,
        lastSeenAt: online ? null : new Date().toISOString(),
      });
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
   * Relay de "escribiendo..." (Fase 3). Efímero: no toca la base ni deja rastro.
   *
   * **La pertenencia se valida en el servidor en cada evento.** El `conversationId` lo manda el
   * cliente por socket, y sin ese chequeo cualquiera con una sesión válida podría avisar que
   * está escribiendo en un hilo ajeno — y, peor, descubrir que ese hilo existe. Si no es
   * miembro, el evento se ignora en silencio: en un socket no hay a quién devolverle un 403.
   *
   * Va a la sala del destinatario y no a una del hilo: no hacen falta salas por conversación
   * para esto (ver el comentario de la clase).
   */
  @SubscribeMessage("typing:start")
  handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId?: string }) {
    return this.relayTyping(client, body?.conversationId, true);
  }

  @SubscribeMessage("typing:stop")
  handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId?: string }) {
    return this.relayTyping(client, body?.conversationId, false);
  }

  private async relayTyping(client: Socket, conversationId: string | undefined, isTyping: boolean) {
    const actor = client.data.user as RequestUser | undefined;
    if (!actor || !conversationId) return;

    // **Un handler de socket corre fuera del request**, así que `TenantRlsContextInterceptor`
    // no seteó `app.tenant_id` y con RLS forzado la consulta de pertenencia devuelve cero filas
    // —no un error—, o sea que el typing se descartaría siempre y en silencio. Es la misma
    // trampa que el feed ICS y los processors de BullMQ; acá se pisó al escribirlo.
    //
    // `message:new` no la sufre porque su dato viaja dentro del evento, justamente para no
    // depender del contexto acá.
    const others = await this.tenantRlsContext.runWithTenant(actor.tenantId, () =>
      this.conversations.resolveOtherMemberUserIds(actor, conversationId),
    );
    if (!others) return;

    for (const userId of others) {
      this.server.to(this.userRoom(userId)).emit("typing", {
        conversationId,
        userId: actor.id,
        isTyping,
      });
    }
  }

  /**
   * Alguien leyó el hilo: al otro se le vuelven azules los checks sin recargar.
   *
   * Va con el `lastReadAt` porque el cliente lo compara contra la fecha de cada mensaje propio
   * para decidir cuáles están leídos — no alcanza con "leyó algo".
   */
  @OnEvent(NOTIFICATION_EVENTS.CONVERSATION_READ)
  handleConversationRead(event: ConversationReadEvent) {
    for (const userId of event.recipientUserIds) {
      this.server.to(this.userRoom(userId)).emit("conversation:read", {
        conversationId: event.conversationId,
        userId: event.readerUserId,
        lastReadAt: event.lastReadAt,
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
