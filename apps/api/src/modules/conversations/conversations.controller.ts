import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AccessScope } from "@prisma/client";
import { DataScope } from "../../common/decorators/data-scope.decorator";
import { DataScopeGuard } from "../../common/guards/data-scope.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  BroadcastInput,
  CreateConversationInput,
  SendMessageInput,
  broadcastSchema,
  createConversationSchema,
  sendMessageSchema,
} from "./conversations.schemas";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.DATOS_PERSONALES)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @Permissions(PERMISSIONS.MESSAGING_LIST)
  list(@CurrentUser() user: RequestUser) {
    return this.conversations.listConversations(user);
  }

  @Get("contacts")
  @Permissions(PERMISSIONS.MESSAGING_LIST)
  contacts(@CurrentUser() user: RequestUser) {
    return this.conversations.listContacts(user);
  }

  @Get("broadcast/targets")
  @Permissions(PERMISSIONS.MESSAGING_BROADCAST)
  broadcastTargets(@CurrentUser() user: RequestUser) {
    return this.conversations.listBroadcastTargets(user);
  }

  @Post("broadcast")
  @Permissions(PERMISSIONS.MESSAGING_BROADCAST)
  broadcast(
    @Body(new ZodValidationPipe(broadcastSchema)) body: BroadcastInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.conversations.broadcast(user, body, request);
  }

  @Post()
  @Permissions(PERMISSIONS.MESSAGING_SEND)
  create(
    @Body(new ZodValidationPipe(createConversationSchema)) body: CreateConversationInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.conversations.createOrGetDirect(user, body.participantId);
  }

  @Post(":id/messages")
  @Permissions(PERMISSIONS.MESSAGING_SEND)
  send(
    @Param("id") conversationId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.conversations.sendMessage(user, conversationId, body);
  }

  @Post(":id/read")
  @Permissions(PERMISSIONS.MESSAGING_READ)
  markRead(@Param("id") conversationId: string, @CurrentUser() user: RequestUser) {
    return this.conversations.markRead(user, conversationId);
  }

  @Delete(":id/messages/:messageId")
  @Permissions(PERMISSIONS.MESSAGING_DELETE)
  deleteMessage(
    @Param("id") conversationId: string,
    @Param("messageId") messageId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.conversations.softDeleteMessage(user, conversationId, messageId, request);
  }
}
