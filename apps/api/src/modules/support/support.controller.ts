import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, ForbiddenException } from "@nestjs/common"
import { Request } from "express"
import { UserRole } from "@prisma/client"
import { SupportService } from "./support.service"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { RequestUser } from "../../common/types/request-context"
import {
  createTicketSchema,
  CreateTicketDto,
  updateTicketStatusSchema,
  UpdateTicketStatusDto,
  createCommentSchema,
  CreateCommentDto,
  assignTicketSchema,
  AssignTicketDto
} from "./support.schemas"

// "Staff" = todo el personal de la plataforma que trabaja soporte (ve la
// bandeja global, comenta, cambia estado). "Supervisor" = quien además
// decide quién trabaja cada ticket y puede entrar al colegio: SUPER_ADMIN
// (dueño de la plataforma) o SUPPORT_SUPERVISOR (lidera soporte sin tener
// el resto del poder de plataforma).
function isSupportStaff(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SUPPORT_SUPERVISOR || role === UserRole.SUPPORT_AGENT
}

function isSupportSupervisor(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SUPPORT_SUPERVISOR
}

@Controller("support")
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post("tickets")
  async createTicket(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(createTicketSchema)) data: CreateTicketDto
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException("Solo usuarios institucionales pueden abrir tickets de soporte")
    }
    return this.supportService.createTicket(user.tenantId, user.id, data, user, request)
  }

  @Get("tickets")
  async listTickets(@CurrentUser() user: RequestUser) {
    if (isSupportStaff(user.role)) {
      return this.supportService.getAllTicketsForSuperAdmin()
    }

    if (user.tenantId) {
      return this.supportService.getTicketsForTenant(user.tenantId)
    }

    return []
  }

  @Get("tickets/:id")
  async getTicketDetails(@CurrentUser() user: RequestUser, @Param("id") ticketId: string) {
    return this.supportService.getTicketDetails(ticketId, isSupportStaff(user.role), user.tenantId)
  }

  @Patch("tickets/:id/status")
  async updateTicketStatus(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(updateTicketStatusSchema)) data: UpdateTicketStatusDto
  ) {
    if (!isSupportStaff(user.role)) {
      throw new ForbiddenException("Solo el personal de soporte puede cambiar el estado de un ticket")
    }
    return this.supportService.updateTicketStatus(ticketId, data, user, request)
  }

  @Post("tickets/:id/comments")
  async addComment(
    @CurrentUser() user: RequestUser,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) data: CreateCommentDto
  ) {
    return this.supportService.addComment(ticketId, user.id, data, isSupportStaff(user.role), user.tenantId)
  }

  @Get("agents")
  async getAgents(@CurrentUser() user: RequestUser) {
    if (!isSupportStaff(user.role)) {
      throw new ForbiddenException("Solo el personal SaaS puede ver los agentes")
    }
    return this.supportService.getSupportAgents()
  }

  @Patch("tickets/:id/assign")
  async assignTicket(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(assignTicketSchema)) data: AssignTicketDto
  ) {
    // Solo el supervisor decide quién trabaja cada ticket; un agente no se
    // autoasigna ni reasigna tickets.
    if (!isSupportSupervisor(user.role)) {
      throw new ForbiddenException("Solo un supervisor puede asignar tickets")
    }
    return this.supportService.assignTicket(ticketId, data.assigneeId, user, request)
  }
}
