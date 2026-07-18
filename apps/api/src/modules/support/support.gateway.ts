import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { UseGuards, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { Server, Socket } from "socket.io";
import { WsJwtGuard, verifyAndDecodeToken } from "../../common/guards/ws-jwt.guard";
import { OnEvent } from "@nestjs/event-emitter";
import { SupportService } from "./support.service";

function isSupportStaff(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SUPPORT_SUPERVISOR || role === UserRole.SUPPORT_AGENT;
}

function extractToken(client: Socket): string | undefined {
  return (
    (client.handshake.auth?.token as string | undefined) ||
    client.handshake.headers?.authorization?.replace("Bearer ", "")
  );
}

@WebSocketGateway({ namespace: "support" })
@UseGuards(WsJwtGuard)
export class SupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(SupportGateway.name);

  // Timers que expulsan al cliente en cuanto su JWT expira (los sockets no
  // reciben un 401 solos: sin esto, un cliente puede quedar "conectado" con
  // un token vencido indefinidamente).
  private expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly supportService: SupportService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    // Verificación activa del JWT al conectar: sin esto, cualquiera podía
    // abrir el socket sin credenciales válidas y quedarse conectado
    // indefinidamente (solo se rechazaba al primer @SubscribeMessage), lo
    // que permite agotar memoria del servidor con conexiones anónimas.
    const token = extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      client.data.user = await verifyAndDecodeToken(token, this.jwt, this.config);
    } catch {
      client.disconnect(true);
      return;
    }

    this.scheduleExpiry(client, token);
  }

  handleDisconnect(client: Socket) {
    const timer = this.expiryTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(client.id);
    }
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
      client.emit("token_expired");
      client.disconnect(true);
    }, msUntilExpiry);

    this.expiryTimers.set(client.id, timer);
  }

  @SubscribeMessage("ticket:join")
  async handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { ticketId: string }
  ) {
    const user = client.data.user;
    if (!user) return;
    
    const isSuperAdmin = isSupportStaff(user.role);
    try {
      await this.supportService.getTicketDetails(payload.ticketId, isSuperAdmin, user.tenantId);
      void client.join(`ticket:${payload.ticketId}`);
      if (isSuperAdmin) {
        void client.join(`ticket:${payload.ticketId}:internal`);
      }
    } catch {
      // Ignore if unauthorized
    }
  }

  @SubscribeMessage("ticket:leave")
  handleLeaveTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { ticketId: string }
  ) {
    void client.leave(`ticket:${payload.ticketId}`);
    void client.leave(`ticket:${payload.ticketId}:internal`);
  }

  @SubscribeMessage("dashboard:join")
  handleJoinDashboard(
    @ConnectedSocket() client: Socket
  ) {
    const user = client.data.user;
    if (!user) return;

    if (isSupportStaff(user.role)) {
      void client.join("dashboard:superadmin");
    } else if (user.tenantId) {
      void client.join(`dashboard:tenant:${user.tenantId}`);
    }
  }

  @SubscribeMessage("dashboard:leave")
  handleLeaveDashboard(
    @ConnectedSocket() client: Socket
  ) {
    const user = client.data.user;
    if (!user) return;

    if (isSupportStaff(user.role)) {
      void client.leave("dashboard:superadmin");
    } else if (user.tenantId) {
      void client.leave(`dashboard:tenant:${user.tenantId}`);
    }
  }

  @SubscribeMessage("typing:start")
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { ticketId: string }
  ) {
    client.to(`ticket:${payload.ticketId}`).emit("typing", {
      ticketId: payload.ticketId,
      userId: client.data.user?.id,
      isTyping: true,
    });
  }

  @SubscribeMessage("typing:stop")
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { ticketId: string }
  ) {
    client.to(`ticket:${payload.ticketId}`).emit("typing", {
      ticketId: payload.ticketId,
      userId: client.data.user?.id,
      isTyping: false,
    });
  }

  @OnEvent("support.comment.added")
  handleCommentAdded(payload: { ticketId: string; tenantId?: string; comment: any }) {
    if (payload.comment.isInternal) {
      this.server.to(`ticket:${payload.ticketId}:internal`).emit("ticket:comment", payload);
    } else {
      this.server.to(`ticket:${payload.ticketId}`).emit("ticket:comment", payload);
    }
    
    // Also notify dashboards to update their list/unread counters
    this.server.to("dashboard:superadmin").emit("ticket:updated", { ticketId: payload.ticketId });
    if (payload.tenantId) {
      this.server.to(`dashboard:tenant:${payload.tenantId}`).emit("ticket:updated", { ticketId: payload.ticketId });
    }
  }

  @OnEvent("support.ticket.created")
  handleTicketCreated(payload: any) {
    this.server.to("dashboard:superadmin").emit("ticket:created", payload);
    this.server.to(`dashboard:tenant:${payload.tenantId}`).emit("ticket:created", payload);
  }

  @OnEvent("support.ticket.updated")
  handleTicketUpdated(payload: any) {
    this.server.to("dashboard:superadmin").emit("ticket:updated", payload);
    this.server.to(`dashboard:tenant:${payload.tenantId}`).emit("ticket:updated", payload);
  }
}
