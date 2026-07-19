import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AccessScope } from "@prisma/client";
import { DataScope } from "../../common/decorators/data-scope.decorator";
import { DataScopeGuard } from "../../common/guards/data-scope.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { UpdatePreferenceInput, updatePreferenceSchema } from "./notifications.schemas";
import { NotificationsService } from "./notifications.service";

// Las notificaciones son siempre del propio usuario (userId = actor.id), por lo que
// basta con estar autenticado; no requieren un permiso RBAC específico.
@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.OPERATIVO)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.notifications.listForUser(user);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user);
  }

  @Get("preferences")
  preferences(@CurrentUser() user: RequestUser) {
    return this.notifications.getPreferences(user);
  }

  @Put("preferences")
  updatePreference(
    @Body(new ZodValidationPipe(updatePreferenceSchema)) body: UpdatePreferenceInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notifications.updatePreference(user, body);
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user);
  }

  @Post(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(user, id);
  }
}
