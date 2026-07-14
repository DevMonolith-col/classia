import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConversationType, MembershipStatus, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { BroadcastInput, SendMessageInput } from "./conversations.schemas";

const ADMIN_STAFF_ROLES: UserRole[] = [
  UserRole.TENANT_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.COORDINATOR,
  UserRole.SECRETARY,
];

type ContactUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Lectura ────────────────────────────────────────────────────────────────

  async listConversations(actor: RequestUser) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId: actor.tenantId,
        archivedAt: null,
        members: { some: { userId: actor.id } },
      },
      select: this.conversationSelect(actor.tenantId),
    });

    return conversations
      .map((conversation) => this.mapConversation(conversation, actor))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async listContacts(actor: RequestUser): Promise<ContactUser[]> {
    if (actor.role === UserRole.GUARDIAN) {
      const childGroupIds = await this.resolveOwnChildGroupIds(actor);
      const teacherUserIds = await this.resolveTeacherUserIdsForGroups(actor.tenantId, childGroupIds);
      const adminUserIds = await this.resolveAdminStaffUserIds(actor.tenantId);
      return this.fetchContactUsers(actor.tenantId, [...teacherUserIds, ...adminUserIds], actor.id);
    }

    if (actor.role === UserRole.TEACHER) {
      const myGroupIds = await this.resolveTeacherGroupIds(actor);
      const guardianUserIds = await this.resolveGuardianUserIdsForGroups(actor.tenantId, myGroupIds);
      const adminUserIds = await this.resolveAdminStaffUserIds(actor.tenantId);
      return this.fetchContactUsers(actor.tenantId, [...guardianUserIds, ...adminUserIds], actor.id);
    }

    if (this.isAdminStaff(actor.role)) {
      const memberships = await this.prisma.tenantMembership.findMany({
        where: {
          tenantId: actor.tenantId,
          status: MembershipStatus.ACTIVE,
          role: { in: [UserRole.TEACHER, UserRole.GUARDIAN, ...ADMIN_STAFF_ROLES] },
        },
        select: { userId: true },
      });
      return this.fetchContactUsers(
        actor.tenantId,
        memberships.map((membership) => membership.userId),
        actor.id,
      );
    }

    return [];
  }

  async listBroadcastTargets(actor: RequestUser) {
    let groupIds: string[];

    if (this.isAdminStaff(actor.role)) {
      const groups = await this.prisma.group.findMany({
        where: { tenantId: actor.tenantId },
        select: { id: true },
      });
      groupIds = groups.map((group) => group.id);
    } else if (actor.role === UserRole.TEACHER) {
      groupIds = await this.resolveTeacherGroupIds(actor);
    } else {
      return [];
    }

    if (groupIds.length === 0) return [];

    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds } },
      select: { id: true, name: true, grade: true, section: true },
      orderBy: [{ grade: "asc" }, { section: "asc" }],
    });

    const targets = [];
    for (const group of groups) {
      const guardianUserIds = await this.resolveGroupGuardianUserIds(actor.tenantId, group.id);
      targets.push({
        groupId: group.id,
        groupName: group.name,
        grade: group.grade,
        section: group.section,
        recipientCount: new Set(guardianUserIds.filter((id) => id !== actor.id)).size,
      });
    }

    return targets;
  }

  // ─── Escritura ───────────────────────────────────────────────────────────────

  async createOrGetDirect(actor: RequestUser, participantId: string) {
    if (participantId === actor.id) {
      throw new ForbiddenException("No puedes iniciar una conversación contigo mismo.");
    }

    await this.assertCanMessage(actor, participantId);

    const conversationId = await this.getOrCreateDirectConversationId(
      actor.tenantId,
      actor.id,
      participantId,
    );
    return this.getConversationSummary(actor, conversationId);
  }

  /**
   * Difusión a un grupo (patrón "mass message"): el mismo mensaje se entrega a cada
   * acudiente del grupo en su propio hilo DIRECT privado con el emisor. Las familias
   * NO comparten hilo ni ven las respuestas de las demás (decisión de producto:
   * respuestas privadas al profesor).
   */
  async broadcast(actor: RequestUser, input: BroadcastInput, request: Request) {
    await this.assertCanBroadcastToGroup(actor, input.groupId);

    const guardianUserIds = await this.resolveGroupGuardianUserIds(actor.tenantId, input.groupId);
    const recipients = [...new Set(guardianUserIds)].filter((id) => id !== actor.id);

    if (recipients.length === 0) {
      return { recipientCount: 0, conversationIds: [] as string[] };
    }

    const now = new Date();
    const conversationIds: string[] = [];

    for (const recipientId of recipients) {
      const conversationId = await this.getOrCreateDirectConversationId(
        actor.tenantId,
        actor.id,
        recipientId,
      );
      await this.prisma.conversationMessage.create({
        data: { conversationId, fromId: actor.id, body: input.body },
      });
      await this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: actor.id } },
        data: { lastReadAt: now },
      });
      conversationIds.push(conversationId);
    }

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "conversation.broadcast",
      entityType: "Group",
      entityId: input.groupId,
      newValues: { recipientCount: recipients.length },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { recipientCount: recipients.length, conversationIds };
  }

  private async getOrCreateDirectConversationId(
    tenantId: string,
    userIdA: string,
    userIdB: string,
  ): Promise<string> {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        type: ConversationType.DIRECT,
        archivedAt: null,
        AND: [
          { members: { some: { userId: userIdA } } },
          { members: { some: { userId: userIdB } } },
        ],
      },
      select: { id: true },
    });

    if (existing) return existing.id;

    const created = await this.prisma.conversation.create({
      data: {
        tenantId,
        type: ConversationType.DIRECT,
        createdById: userIdA,
        members: { create: [{ userId: userIdA }, { userId: userIdB }] },
      },
      select: { id: true },
    });

    return created.id;
  }

  async sendMessage(actor: RequestUser, conversationId: string, input: SendMessageInput) {
    await this.assertMember(actor, conversationId);

    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        fromId: actor.id,
        body: input.body,
        attachmentKey: input.attachmentKey,
        attachmentName: input.attachmentName,
      },
      select: this.messageSelect(),
    });

    // El remitente ya "leyó" todo hasta este punto.
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: actor.id } },
      data: { lastReadAt: new Date() },
    });

    return message;
  }

  async markRead(actor: RequestUser, conversationId: string) {
    await this.assertMember(actor, conversationId);

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: actor.id } },
      data: { lastReadAt: new Date() },
    });

    return { status: "ok" as const };
  }

  async softDeleteMessage(
    actor: RequestUser,
    conversationId: string,
    messageId: string,
    request: Request,
  ) {
    await this.assertMember(actor, conversationId);

    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, fromId: true, deletedAt: true },
    });

    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException("Mensaje no encontrado.");
    }
    if (message.fromId !== actor.id) {
      throw new ForbiddenException("Solo puedes eliminar tus propios mensajes.");
    }
    if (message.deletedAt) {
      return { status: "ok" as const, id: message.id };
    }

    // Soft-delete: se oculta al usuario, pero el registro NUNCA se borra de la BD
    // (retención obligatoria por Ley 1620 de Convivencia Escolar y Ley 527 de Mensajes de Datos).
    const updated = await this.prisma.conversationMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      select: { id: true },
    });

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "conversation.message.deleted",
      entityType: "ConversationMessage",
      entityId: messageId,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { status: "ok" as const, id: updated.id };
  }

  // ─── Autorización ────────────────────────────────────────────────────────────

  private async assertCanMessage(actor: RequestUser, targetUserId: string) {
    const contacts = await this.listContacts(actor);
    if (!contacts.some((contact) => contact.id === targetUserId)) {
      throw new ForbiddenException(
        "No tienes permiso para iniciar una conversación con este usuario.",
      );
    }
  }

  private async assertMember(actor: RequestUser, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: actor.id } },
      select: { id: true, conversation: { select: { tenantId: true } } },
    });

    if (!member || member.conversation.tenantId !== actor.tenantId) {
      throw new ForbiddenException("No perteneces a esta conversación.");
    }
  }

  private async assertCanBroadcastToGroup(actor: RequestUser, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!group) {
      throw new ForbiddenException("El grupo no pertenece a tu institución.");
    }

    if (this.isAdminStaff(actor.role)) return;

    if (actor.role === UserRole.TEACHER) {
      const teacherGroupIds = await this.resolveTeacherGroupIds(actor);
      if (teacherGroupIds.includes(groupId)) return;
      throw new ForbiddenException("Solo puedes difundir a los grupos que enseñas.");
    }

    throw new ForbiddenException("No tienes permiso para difundir mensajes.");
  }

  private async resolveGroupGuardianUserIds(tenantId: string, groupId: string): Promise<string[]> {
    const links = await this.prisma.studentGuardian.findMany({
      where: { student: { tenantId, groupId } },
      select: { guardian: { select: { userId: true } } },
    });
    return links.map((link) => link.guardian.userId);
  }

  // ─── Resolución de contactos ──────────────────────────────────────────────────

  private async resolveOwnChildIds(actor: RequestUser): Promise<string[]> {
    const guardian = await this.prisma.guardian.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { students: { select: { studentId: true } } },
    });
    return guardian?.students.map((student) => student.studentId) ?? [];
  }

  private async resolveOwnChildGroupIds(actor: RequestUser): Promise<string[]> {
    const childIds = await this.resolveOwnChildIds(actor);
    if (childIds.length === 0) return [];

    const children = await this.prisma.student.findMany({
      where: { id: { in: childIds } },
      select: { groupId: true },
    });
    return [
      ...new Set(children.map((child) => child.groupId).filter((groupId): groupId is string => Boolean(groupId))),
    ];
  }

  private async resolveTeacherGroupIds(actor: RequestUser): Promise<string[]> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!teacher) return [];

    const schedules = await this.prisma.schedule.findMany({
      where: { tenantId: actor.tenantId, teacherId: teacher.id },
      select: { groupId: true },
    });
    return [...new Set(schedules.map((schedule) => schedule.groupId))];
  }

  private async resolveTeacherUserIdsForGroups(tenantId: string, groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) return [];
    const schedules = await this.prisma.schedule.findMany({
      where: { tenantId, groupId: { in: groupIds } },
      select: { teacher: { select: { userId: true } } },
    });
    return schedules.map((schedule) => schedule.teacher.userId);
  }

  private async resolveGuardianUserIdsForGroups(tenantId: string, groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) return [];
    const links = await this.prisma.studentGuardian.findMany({
      where: { student: { tenantId, groupId: { in: groupIds } } },
      select: { guardian: { select: { userId: true } } },
    });
    return links.map((link) => link.guardian.userId);
  }

  private async resolveAdminStaffUserIds(tenantId: string): Promise<string[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId, status: MembershipStatus.ACTIVE, role: { in: ADMIN_STAFF_ROLES } },
      select: { userId: true },
    });
    return memberships.map((membership) => membership.userId);
  }

  private async fetchContactUsers(
    tenantId: string,
    userIds: string[],
    excludeUserId: string,
  ): Promise<ContactUser[]> {
    const uniqueIds = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
    if (uniqueIds.length === 0) return [];

    // Se consulta vía TenantMembership: filtra por tenant, confirma membresía activa y resuelve el rol.
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId, status: MembershipStatus.ACTIVE, userId: { in: uniqueIds } },
      select: {
        role: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });

    return memberships.map((membership) => ({
      id: membership.user.id,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      role: membership.role,
    }));
  }

  private isAdminStaff(role: UserRole) {
    return ADMIN_STAFF_ROLES.includes(role);
  }

  // ─── Mapeo / helpers de forma ──────────────────────────────────────────────────

  private async getConversationSummary(actor: RequestUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: this.conversationSelect(actor.tenantId),
    });
    return this.mapConversation(conversation, actor);
  }

  private mapConversation(
    conversation: ConversationWithRelations,
    actor: RequestUser,
  ) {
    const myMember = conversation.members.find((member) => member.userId === actor.id);
    const lastReadAt = myMember?.lastReadAt ?? null;

    const participants = conversation.members.map((member) => ({
      id: member.user.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      role: member.user.memberships[0]?.role ?? null,
    }));
    const otherParticipants = participants.filter((participant) => participant.id !== actor.id);

    const unreadCount = conversation.messages.filter(
      (message) => message.fromId !== actor.id && (!lastReadAt || message.createdAt > lastReadAt),
    ).length;

    const lastMessage = conversation.messages[conversation.messages.length - 1] ?? null;

    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      participants,
      otherParticipants,
      unreadCount,
      lastMessageAt: lastMessage?.createdAt ?? conversation.createdAt,
      messages: conversation.messages,
    };
  }

  private conversationSelect(tenantId: string) {
    return {
      id: true,
      type: true,
      title: true,
      createdAt: true,
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberships: { where: { tenantId }, select: { role: true } },
            },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" as const },
        select: this.messageSelect(),
      },
    };
  }

  private messageSelect() {
    return {
      id: true,
      fromId: true,
      body: true,
      attachmentKey: true,
      attachmentName: true,
      createdAt: true,
    };
  }
}

type ConversationWithRelations = {
  id: string;
  type: ConversationType;
  title: string | null;
  createdAt: Date;
  members: Array<{
    userId: string;
    lastReadAt: Date | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      memberships: Array<{ role: UserRole }>;
    };
  }>;
  messages: Array<{
    id: string;
    fromId: string;
    body: string;
    attachmentKey: string | null;
    attachmentName: string | null;
    createdAt: Date;
  }>;
};
