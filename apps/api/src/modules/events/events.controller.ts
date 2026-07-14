import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  CreateEventInput,
  ListEventsQuery,
  createEventSchema,
  listEventsQuerySchema,
} from "./events.schemas";
import { EventsService } from "./events.service";

@Controller("events")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @Permissions(PERMISSIONS.EVENTS_LIST)
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listEventsQuerySchema)) query: ListEventsQuery,
  ) {
    return this.events.list(user, query);
  }

  @Post()
  @Permissions(PERMISSIONS.EVENTS_CREATE)
  create(
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.events.create(body, user, request);
  }

  @Delete(":id")
  @Permissions(PERMISSIONS.EVENTS_DELETE)
  remove(@Param("id") eventId: string, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.events.remove(eventId, user, request);
  }
}
