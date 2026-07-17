import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, ForbiddenException } from "@nestjs/common"
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
    return this.supportService.createTicket(req.user.tenantId, req.user.id, data)
  }

  @Get("tickets")
  async listTickets(@Req() req: any) {
    if (req.user.role === "SUPER_ADMIN" || req.user.role === "SUPPORT_AGENT") {
      return this.supportService.getAllTicketsForSuperAdmin()
    }
    
    if (req.user.tenantId) {
      return this.supportService.getTicketsForTenant(req.user.tenantId)
    }

    return []
  }

  @Get("tickets/:id")
  async getTicketDetails(@Req() req: any, @Param("id") ticketId: string) {
    const isSuperAdmin = req.user.role === "SUPER_ADMIN" || req.user.role === "SUPPORT_AGENT"
    return this.supportService.getTicketDetails(ticketId, isSuperAdmin, req.user.tenantId)
  }

  @Patch("tickets/:id/status")
  async updateTicketStatus(
    @Req() req: any,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(updateTicketStatusSchema)) data: UpdateTicketStatusDto
  ) {
    if (req.user.role !== "SUPER_ADMIN" && req.user.role !== "SUPPORT_AGENT") {
      throw new ForbiddenException("Solo el personal de soporte puede cambiar el estado de un ticket")
    }
    return this.supportService.updateTicketStatus(ticketId, data)
  }

  @Post("tickets/:id/comments")
  async addComment(
    @Req() req: any,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) data: CreateCommentDto
  ) {
    const isSuperAdmin = req.user.role === "SUPER_ADMIN" || req.user.role === "SUPPORT_AGENT"
    return this.supportService.addComment(ticketId, req.user.id, data, isSuperAdmin)
  }

  @Get("agents")
  async getAgents(@Req() req: any) {
    if (req.user.role !== "SUPER_ADMIN" && req.user.role !== "SUPPORT_AGENT") {
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
    if (req.user.role !== "SUPER_ADMIN" && req.user.role !== "SUPPORT_AGENT") {
      throw new ForbiddenException("Solo el personal SaaS puede asignar tickets")
    }
    return this.supportService.assignTicket(ticketId, data.assigneeId)
  }
}
