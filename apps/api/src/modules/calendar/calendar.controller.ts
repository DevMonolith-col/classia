import { Controller, Delete, Get, Header, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { RequestUser } from "../../common/types/request-context";
import { CalendarFeedService } from "./calendar-feed.service";
import { FeedTokenThrottlerGuard } from "./feed-token-throttler.guard";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly feed: CalendarFeedService) {}

  /**
   * Feed ICS suscribible. **Pública a propósito y sin ninguno de los guards de sesión**: la
   * consumen Google Calendar, Apple Calendar y Outlook, que no mandan Authorization ni
   * `x-tenant-slug`. La autenticación es el token de la URL.
   *
   * Se declara antes que las rutas de `feed/token` porque `:token.ics` es más específico y no
   * colisiona, pero conviene no reordenarlas sin mirar.
   */
  @Get("feed/:token.ics")
  @UseGuards(FeedTokenThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header("Content-Type", "text/calendar; charset=utf-8")
  @Header("Cache-Control", "private, max-age=300")
  async getFeed(
    @Param("token") token: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const { body, filename } = await this.feed.renderFeed(token, request);
    response.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    response.send(body);
  }

  // ─── Gestión de la propia suscripción (con sesión) ──────────────────────────

  @Get("feed/token")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.EVENTS_LIST)
  getTokenStatus(@CurrentUser() user: RequestUser) {
    return this.feed.getTokenStatus(user);
  }

  /**
   * Emite un token nuevo y revoca el anterior. Devuelve la URL en claro **una sola vez**.
   * Con rate limit porque cada llamada invalida la suscripción anterior: un bucle acá deja a
   * alguien sin calendario sin que se entere.
   */
  @Post("feed/token")
  @UseGuards(JwtAuthGuard, PermissionsGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Permissions(PERMISSIONS.EVENTS_LIST)
  issueToken(@CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.feed.issueToken(user, request);
  }

  @Delete("feed/token")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.EVENTS_LIST)
  revokeToken(@CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.feed.revokeToken(user, request);
  }
}
