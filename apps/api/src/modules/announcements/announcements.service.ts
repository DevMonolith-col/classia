import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  AnnouncementPublishedEvent,
  NOTIFICATION_EVENTS,
} from "../notifications/notifications.events";
import { CreateAnnouncementInput } from "./announcements.schemas";

const ADMIN_STAFF_ROLES: UserRole[] = [
  UserRole.TENANT_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.COORDINATOR,
  UserRole.SECRETARY,
];

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async listForUser(actor: RequestUser) {
    const where = this.isAdminStaff(actor.role)
      ? { tenantId: actor.tenantId }
      : {
          tenantId: actor.tenantId,
          OR: [
            { authorId: actor.id },
            {
              AND: [
                { OR: [{ targetRole: null }, { targetRole: actor.role }] },
                { OR: [{ groupId: null }, { groupId: { in: await this.resolveUserGroupIds(actor) } }] },
              ],
            },
          ],
        };

    const announcements = await this.prisma.announcement.findMany({
      where: { ...where, deletedAt: null }, // los soft-deleted no se listan
      orderBy: { createdAt: "desc" },
      select: this.announcementSelect(actor.id),
    });

    return announcements.map((announcement) => this.mapAnnouncement(announcement));
  }

  async listTargetGroups(actor: RequestUser) {
    if (this.isAdminStaff(actor.role)) {
      return this.prisma.group.findMany({
        where: { tenantId: actor.tenantId },
        select: { id: true, name: true, grade: true, section: true },
        orderBy: [{ grade: "asc" }, { section: "asc" }],
      });
    }

    if (actor.role === UserRole.TEACHER) {
      const groupIds = await this.resolveTeacherGroupIds(actor);
      if (groupIds.length === 0) return [];
      return this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true, grade: true, section: true },
        orderBy: [{ grade: "asc" }, { section: "asc" }],
      });
    }

    return [];
  }

  async create(actor: RequestUser, input: CreateAnnouncementInput, request: Request) {
    if (this.isAdminStaff(actor.role)) {
      if (input.groupId) {
        await this.assertGroupInTenant(input.groupId, actor.tenantId);
      }
    } else if (actor.role === UserRole.TEACHER) {
      if (!input.groupId) {
        throw new ForbiddenException("Debes seleccionar un grupo para publicar como profesor.");
      }
      const teacherGroupIds = await this.resolveTeacherGroupIds(actor);
      if (!teacherGroupIds.includes(input.groupId)) {
        throw new ForbiddenException("Solo puedes publicar comunicados a los grupos que enseñas.");
      }
    } else {
      throw new ForbiddenException("No tienes permiso para publicar comunicados.");
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        tenantId: actor.tenantId,
        authorId: actor.id,
        title: input.title,
        body: input.body,
        targetRole: input.targetRole ?? null,
        groupId: input.groupId ?? null,
      },
      select: this.announcementSelect(actor.id),
    });

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "announcement.created",
      entityType: "Announcement",
      entityId: announcement.id,
      newValues: this.toAuditJson({
        title: input.title,
        targetRole: input.targetRole ?? null,
        groupId: input.groupId ?? null,
      }),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    this.events.emit(NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED, {
      tenantId: actor.tenantId,
      announcementId: announcement.id,
      authorId: actor.id,
      title: input.title,
      targetRole: input.targetRole ?? null,
      groupId: input.groupId ?? null,
    } satisfies AnnouncementPublishedEvent);

    return this.mapAnnouncement(announcement);
  }

  async markRead(actor: RequestUser, announcementId: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id: announcementId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!announcement) {
      throw new NotFoundException("Comunicado no encontrado.");
    }

    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId: actor.id } },
      update: {},
      create: { announcementId, userId: actor.id, tenantId: actor.tenantId },
    });

    return { status: "ok" as const };
  }

  async delete(actor: RequestUser, announcementId: string, request: Request) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id: announcementId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!announcement) {
      throw new NotFoundException("Comunicado no encontrado.");
    }
    if (!this.isAdminStaff(actor.role) && announcement.authorId !== actor.id) {
      throw new ForbiddenException("Solo puedes eliminar tus propios comunicados.");
    }

    // Soft-delete: comunicación oficial, se conserva la fila (Ley 1620/527).
    await this.prisma.announcement.update({
      where: { id: announcementId },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "announcement.deleted",
      entityType: "Announcement",
      entityId: announcementId,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { status: "ok" as const };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertGroupInTenant(groupId: string, tenantId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });
    if (!group) {
      throw new ForbiddenException("El grupo no pertenece a tu institución.");
    }
  }

  private async resolveUserGroupIds(actor: RequestUser): Promise<string[]> {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId: actor.id, tenantId: actor.tenantId },
        select: { groupId: true },
      });
      return student?.groupId ? [student.groupId] : [];
    }

    if (actor.role === UserRole.GUARDIAN) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { userId: actor.id, tenantId: actor.tenantId },
        select: { students: { select: { student: { select: { groupId: true } } } } },
      });
      const groupIds =
        guardian?.students
          .map((link) => link.student.groupId)
          .filter((groupId): groupId is string => Boolean(groupId)) ?? [];
      return [...new Set(groupIds)];
    }

    if (actor.role === UserRole.TEACHER) {
      return this.resolveTeacherGroupIds(actor);
    }

    return [];
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

  private isAdminStaff(role: UserRole) {
    return ADMIN_STAFF_ROLES.includes(role);
  }

  private announcementSelect(userId: string) {
    return {
      id: true,
      title: true,
      body: true,
      targetRole: true,
      createdAt: true,
      author: { select: { id: true, firstName: true, lastName: true } },
      group: { select: { id: true, name: true, grade: true, section: true } },
      reads: { where: { userId }, select: { id: true } },
    };
  }

  private mapAnnouncement<T extends { reads: Array<{ id: string }> }>(announcement: T) {
    const { reads, ...rest } = announcement;
    return { ...rest, isRead: reads.length > 0 };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
