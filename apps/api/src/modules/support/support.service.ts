import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { Request } from "express"
import { RequestUser } from "../../common/types/request-context"
import { AuditService } from "../../core/audit/audit.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { CreateTicketDto, UpdateTicketStatusDto, CreateCommentDto } from "./support.schemas"

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  async createTicket(tenantId: string, userId: string, data: CreateTicketDto, actor: RequestUser, request: Request) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId,
        authorId: userId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority as any,
        attachmentKey: data.attachmentKey,
        attachmentName: data.attachmentName,
      },
    })

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "support_ticket.created",
      entityType: "SupportTicket",
      entityId: ticket.id,
      newValues: { title: ticket.title, category: ticket.category, priority: ticket.priority },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    this.eventEmitter.emit("support.ticket.created", ticket)
    return ticket
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
        author: { select: { id: true, firstName: true, lastName: true } },
        tenant: { select: { name: true, slug: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                memberships: { select: { role: true } }
              }
            }
          }
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

  async updateTicketStatus(ticketId: string, data: UpdateTicketStatusDto, actor: RequestUser, request: Request) {
    const previous = await this.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { status: true, tenantId: true },
    })

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: data.status as any },
      include: { tenant: true }
    })

    await this.audit.record({
      tenantId: ticket.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "support_ticket.status_changed",
      entityType: "SupportTicket",
      entityId: ticket.id,
      oldValues: { status: previous.status },
      newValues: { status: ticket.status },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    this.eventEmitter.emit("support.ticket.updated", ticket)
    return ticket
  }

  async addComment(ticketId: string, userId: string, data: CreateCommentDto, isSuperAdmin: boolean) {
    // If not superadmin, force isInternal to false
    const isInternal = isSuperAdmin ? data.isInternal : false

    const newComment = await this.prisma.$transaction(async (tx: any) => {
      const comment = await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: userId,
          content: data.content,
          isInternal,
          attachmentKey: data.attachmentKey,
          attachmentName: data.attachmentName,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberships: { select: { role: true } }
            }
          }
        }
      })
      
      // Update the ticket updatedAt timestamp
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() }
      })

      return comment
    })
    
    // Attach the ticket info for the gateway to know the tenantId
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { tenantId: true }
    })
    
    this.eventEmitter.emit("support.comment.added", {
      ticketId,
      tenantId: ticket?.tenantId,
      comment: newComment,
    })

    return newComment
  }

  async assignTicket(ticketId: string, assigneeId: string | null, actor: RequestUser, request: Request) {
    const previous = await this.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { assigneeId: true, tenantId: true },
    })

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assigneeId },
      include: { tenant: true }
    })

    await this.audit.record({
      tenantId: ticket.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "support_ticket.assigned",
      entityType: "SupportTicket",
      entityId: ticket.id,
      oldValues: { assigneeId: previous.assigneeId },
      newValues: { assigneeId: ticket.assigneeId },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    this.eventEmitter.emit("support.ticket.updated", ticket)
    return ticket
  }

  async getSupportAgents() {
    // Role vive en TenantMembership, no en User (RBAC es por-tenant); un mismo
    // usuario puede tener membership SUPER_ADMIN/SUPPORT_SUPERVISOR/SUPPORT_AGENT
    // en más de un tenant, así que se deduplica por userId.
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "SUPPORT_SUPERVISOR", "SUPPORT_AGENT"] },
        status: "ACTIVE",
        user: { status: "ACTIVE" },
      },
      select: {
        role: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      distinct: ["userId"],
      orderBy: [{ userId: "asc" }],
    })

    return memberships.map((m) => ({ ...m.user, role: m.role }))
  }
}
