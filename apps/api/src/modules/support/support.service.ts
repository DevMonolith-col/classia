import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import { PrismaService } from "../../core/prisma/prisma.service"
import { CreateTicketDto, UpdateTicketStatusDto, CreateCommentDto } from "./support.schemas"

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(tenantId: string, userId: string, data: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        tenantId,
        authorId: userId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority as any,
      },
    })
  }

  async getTicketsForTenant(tenantId: string) {
    return this.prisma.supportTicket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { comments: true }
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    })
  }

  async getAllTicketsForSuperAdmin() {
    return this.prisma.supportTicket.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        tenant: {
          select: { name: true, slug: true, primaryDomain: true }
        },
        _count: {
          select: { comments: true }
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    })
  }

  async getTicketDetails(ticketId: string, isSuperAdmin: boolean, tenantId?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { select: { name: true, slug: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        comments: {
          orderBy: { createdAt: "asc" }
        }
      }
    })

    if (!ticket) throw new NotFoundException("Ticket no encontrado")
    
    if (!isSuperAdmin && ticket.tenantId !== tenantId) {
      throw new ForbiddenException("No tienes acceso a este ticket")
    }

    // Filter out internal comments if not superadmin
    if (!isSuperAdmin) {
      ticket.comments = ticket.comments.filter((c: any) => !c.isInternal)
    }

    return ticket
  }

  async updateTicketStatus(ticketId: string, data: UpdateTicketStatusDto) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: data.status as any },
    })
  }

  async addComment(ticketId: string, userId: string, data: CreateCommentDto, isSuperAdmin: boolean) {
    // If not superadmin, force isInternal to false
    const isInternal = isSuperAdmin ? data.isInternal : false

    return this.prisma.$transaction(async (tx: any) => {
      const comment = await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: userId,
          content: data.content,
          isInternal,
        }
      })
      
      // Update the ticket updatedAt timestamp
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() }
      })

      return comment
    })
  }

  async assignTicket(ticketId: string, assigneeId: string | null) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assigneeId }
    })
  }

  async getSupportAgents() {
    return this.prisma.user.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "SUPPORT_AGENT"] },
        status: "ACTIVE"
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      },
      orderBy: { firstName: "asc" }
    })
  }
}
