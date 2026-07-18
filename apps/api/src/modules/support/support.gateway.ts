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
import { Server, Socket } from "socket.io";
import { WsJwtGuard } from "../../common/guards/ws-jwt.guard";
import { OnEvent } from "@nestjs/event-emitter";
import { SupportService } from "./support.service";

@WebSocketGateway({ namespace: "support" })
@UseGuards(WsJwtGuard)
export class SupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(SupportGateway.name);

  constructor(private readonly supportService: SupportService) {}

  handleConnection(client: Socket) {
    // Check if token is invalid, but WsJwtGuard applies at the class level for SubscribeMessage.
    // For pure connection, we can just allow it and let SubscribeMessage reject,
    // or manually verify here. WsJwtGuard handles messages well.
  }

  handleDisconnect(client: Socket) {
    // Clean up if needed
  }

  @SubscribeMessage("ticket:join")
  async handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { ticketId: string }
  ) {
    const user = client.data.user;
    if (!user) return;
    
    const isSuperAdmin = user.role === "SUPER_ADMIN" || user.role === "SUPPORT_AGENT";
    try {
      await this.supportService.getTicketDetails(payload.ticketId, isSuperAdmin, user.tenantId);
      void client.join(`ticket:${payload.ticketId}`);
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
  handleCommentAdded(payload: { ticketId: string; comment: any }) {
    this.server.to(`ticket:${payload.ticketId}`).emit("ticket:comment", payload);
  }
}
