import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AccessScope } from "@prisma/client";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { DataScope } from "../../common/decorators/data-scope.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { DataScopeGuard } from "../../common/guards/data-scope.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { DemoRequestsService } from "./demo-requests.service";
import {
  CreateDemoRequestInput,
  ListDemoRequestsQuery,
  UpdateDemoRequestInput,
  createDemoRequestSchema,
  listDemoRequestsQuerySchema,
  updateDemoRequestSchema,
} from "./demo-requests.schemas";

@Controller("demo-requests")
export class DemoRequestsController {
  constructor(private readonly demoRequests: DemoRequestsService) {}

  /**
   * Formulario de "solicitar demo" del sitio público.
   *
   * **Pública a propósito y sin ninguno de los guards de sesión**, igual que el feed ICS del
   * calendario: la manda un rector que todavía no es cliente, así que no hay JWT ni
   * `x-tenant-slug` que valer. Lo que la protege es el rate-limit por IP y que el cuerpo
   * está acotado por Zod campo por campo.
   *
   * Responde 201 **sin cuerpo**: devolver el id le daría a cualquiera en internet un
   * identificador válido de una fila que solo el equipo interno puede leer.
   *
   * 5 por minuto por IP: un colegio manda una, quizá dos si se equivoca. Es el mismo orden
   * que el login (5/min) y bastante más apretado que el refresh (20/min).
   */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(
    @Body(new ZodValidationPipe(createDemoRequestSchema)) body: CreateDemoRequestInput,
  ) {
    await this.demoRequests.create(body);
  }

  // ─── Bandeja interna (con sesión) ───────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.OPERATIVO)
  @Permissions(PERMISSIONS.DEMO_REQUESTS_LIST)
  list(
    @Query(new ZodValidationPipe(listDemoRequestsQuerySchema)) query: ListDemoRequestsQuery,
  ) {
    return this.demoRequests.list(query);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.OPERATIVO)
  @Permissions(PERMISSIONS.DEMO_REQUESTS_READ)
  findOne(@Param("id") id: string) {
    return this.demoRequests.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.OPERATIVO)
  @Permissions(PERMISSIONS.DEMO_REQUESTS_UPDATE)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDemoRequestSchema)) body: UpdateDemoRequestInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.demoRequests.update(id, body, user, request);
  }
}
