import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
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
  UpdateEventInput,
  createEventSchema,
  listEventsQuerySchema,
  updateEventSchema,
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

  // EVENTS_READ existía declarado y sin usar en ninguna ruta desde que se creó el módulo.
  // Esta es la ruta que le da sentido; la alternativa era borrar el permiso.
  @Get(":id")
  @Permissions(PERMISSIONS.EVENTS_READ)
  findOne(@Param("id") eventId: string, @CurrentUser() user: RequestUser) {
    return this.events.findOne(eventId, user);
  }

  // TEACHER también tiene EVENTS_CREATE, pero el servicio le exige `groupId` y valida que
  // sea uno de los suyos. El alcance no cabe en el permiso de ruta porque depende de una
  // consulta (Schedule → grupos), así que PermissionsGuard abre la puerta y
  // EventsService#resolveWritableGroupId decide hasta dónde.
  @Post()
  @Permissions(PERMISSIONS.EVENTS_CREATE)
  create(
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.events.create(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.EVENTS_UPDATE)
  update(
    @Param("id") eventId: string,
    @Body(new ZodValidationPipe(updateEventSchema)) body: UpdateEventInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.events.update(eventId, body, user, request);
  }

  @Delete(":id")
  @Permissions(PERMISSIONS.EVENTS_DELETE)
  remove(@Param("id") eventId: string, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.events.remove(eventId, user, request);
  }
}
