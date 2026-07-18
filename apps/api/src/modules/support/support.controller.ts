import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, ForbiddenException, HttpException } from "@nestjs/common"
import { SupportService } from "./support.service"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
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
function isSupportStaff(role: string) {
  return role === "SUPER_ADMIN" || role === "SUPPORT_SUPERVISOR" || role === "SUPPORT_AGENT"
}

function isSupportSupervisor(role: string) {
  return role === "SUPER_ADMIN" || role === "SUPPORT_SUPERVISOR"
}

@Controller("support")
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post("tickets")
  async createTicket(
    @Req() req: any,
    @Body(new ZodValidationPipe(createTicketSchema)) data: CreateTicketDto
  ) {
    if (!req.user.tenantId) {
      throw new ForbiddenException("Solo usuarios institucionales pueden abrir tickets de soporte")
    }
    return this.supportService.createTicket(req.user.tenantId, req.user.id, data, req.user, req)
  }

  @Get("tickets")
  async listTickets(@Req() req: any) {
    if (isSupportStaff(req.user.role)) {
      return this.supportService.getAllTicketsForSuperAdmin()
    }

    if (req.user.tenantId) {
      return this.supportService.getTicketsForTenant(req.user.tenantId)
    }

    return []
  }

  @Get("tickets/:id")
  async getTicketDetails(@Req() req: any, @Param("id") ticketId: string) {
    try {
      return await this.supportService.getTicketDetails(ticketId, isSupportStaff(req.user.role), req.user.tenantId)
    } catch (e: any) {
      throw new HttpException(e?.message || "Unknown error", 501)
    }
  }

  @Patch("tickets/:id/status")
  async updateTicketStatus(
    @Req() req: any,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(updateTicketStatusSchema)) data: UpdateTicketStatusDto
  ) {
    if (!isSupportStaff(req.user.role)) {
      throw new ForbiddenException("Solo el personal de soporte puede cambiar el estado de un ticket")
    }
    return this.supportService.updateTicketStatus(ticketId, data, req.user, req)
  }

  @Post("tickets/:id/comments")
  async addComment(
    @Req() req: any,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) data: CreateCommentDto
  ) {
    return this.supportService.addComment(ticketId, req.user.id, data, isSupportStaff(req.user.role))
  }

  @Get("agents")
  async getAgents(@Req() req: any) {
    if (!isSupportStaff(req.user.role)) {
      throw new ForbiddenException("Solo el personal SaaS puede ver los agentes")
    }
    return this.supportService.getSupportAgents()
  }

  @Patch("tickets/:id/assign")
  async assignTicket(
    @Req() req: any,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(assignTicketSchema)) data: AssignTicketDto
  ) {
    // Solo el supervisor decide quién trabaja cada ticket; un agente no se
    // autoasigna ni reasigna tickets.
    if (!isSupportSupervisor(req.user.role)) {
      throw new ForbiddenException("Solo un supervisor puede asignar tickets")
    }
    return this.supportService.assignTicket(ticketId, data.assigneeId, req.user, req)
  }
}
