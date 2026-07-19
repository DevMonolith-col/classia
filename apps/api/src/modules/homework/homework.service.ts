import { ForbiddenException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  HomeworkAssignedEvent,
  NOTIFICATION_EVENTS,
} from "../notifications/notifications.events";
import { CreateHomeworkInput, ListHomeworkQuery, UpdateHomeworkInput } from "./homework.schemas";

@Injectable()
export class HomeworkService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(actor: RequestUser, query: ListHomeworkQuery) {
    let targetYearId = query.academicYearId;
    if (!targetYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId: this.resolveTenantScope(actor, query.tenantId) ?? actor.tenantId, isActive: true },
      });
      targetYearId = activeYear?.id;
    }

    const commonFilter = {
      ...(targetYearId ? { academicYearId: targetYearId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    };

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (!ownTeacherId) return [];

      return this.prisma.homework.findMany({
        where: { teacherId: ownTeacherId, ...commonFilter },
        select: this.homeworkSelect(),
        orderBy: [{ dueDate: "desc" }],
      });
    }

    if (actor.role === UserRole.STUDENT) {
      const ownGroupId = await this.resolveOwnStudentGroupId(actor);
      if (!ownGroupId) return [];

      return this.prisma.homework.findMany({
        where: { ...commonFilter, groupId: ownGroupId },
        select: this.homeworkSelect(),
        orderBy: [{ dueDate: "desc" }],
      });
    }

    if (actor.role === UserRole.GUARDIAN) {
      const childGroupIds = await this.resolveOwnChildGroupIds(actor);
      if (childGroupIds.length === 0) return [];

      return this.prisma.homework.findMany({
        where: { ...commonFilter, groupId: { in: childGroupIds } },
        select: this.homeworkSelect(),
        orderBy: [{ dueDate: "desc" }],
      });
    }

    const scopedTenantId = this.resolveTenantScope(actor, query.tenantId);

    return this.prisma.homework.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...commonFilter,
      },
      select: this.homeworkSelect(),
      orderBy: [{ dueDate: "desc" }],
    });
  }

  async findOne(homeworkId: string, actor: RequestUser) {
    const homework = await this.prisma.homework.findUniqueOrThrow({
      where: { id: homeworkId },
      select: this.homeworkSelect(),
    });

    await this.assertCanAccessHomework(homework.tenantId, homework.teacher.id, homework.group.id, actor);

    return homework;
  }

  async create(input: CreateHomeworkInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for homework.");
    }

    const teacherId = await this.resolveTeacherId(actor, input.teacherId, tenantId);

    await this.assertGroupBelongsToTenant(input.groupId, tenantId);
    await this.assertSubjectBelongsToTenant(input.subjectId, tenantId);

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!activeYear) {
      throw new ForbiddenException("No hay un año académico activo para este colegio.");
    }

    const homework = await this.prisma.homework.create({
      data: {
        tenantId,
        groupId: input.groupId,
        subjectId: input.subjectId,
        teacherId,
        academicYearId: activeYear.id,
        title: input.title,
        description: input.description,
        availableFrom: input.availableFrom,
        dueDate: input.dueDate,
        cutOffDate: input.cutOffDate,
        weight: input.weight ?? 0,
        type: input.type ?? "TAREA",
        allowNavigation: input.allowNavigation ?? true,
        attachmentKey: input.attachmentKey,
        attachmentName: input.attachmentName,
      },
      select: this.homeworkSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "homework.created",
      entityType: "Homework",
      entityId: homework.id,
      newValues: this.toAuditJson(homework),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    this.events.emit(NOTIFICATION_EVENTS.HOMEWORK_ASSIGNED, {
      tenantId: homework.tenantId,
      homeworkId: homework.id,
      groupId: homework.group.id,
      title: homework.title,
    } satisfies HomeworkAssignedEvent);

    return homework;
  }

  async update(homeworkId: string, input: UpdateHomeworkInput, actor: RequestUser, request: Request) {
    const previous = await this.prisma.homework.findUniqueOrThrow({
      where: { id: homeworkId },
      select: this.homeworkSelect(),
    });

    await this.assertCanAccessHomework(previous.tenantId, previous.teacher.id, previous.group.id, actor);

    const homework = await this.prisma.homework.update({
      where: { id: homeworkId },
      data: {
        title: input.title,
        description: input.description === null ? null : input.description,
        availableFrom: input.availableFrom === null ? null : input.availableFrom,
        dueDate: input.dueDate,
        cutOffDate: input.cutOffDate === null ? null : input.cutOffDate,
        weight: input.weight,
        type: input.type,
        allowNavigation: input.allowNavigation,
        attachmentKey: input.attachmentKey === null ? null : input.attachmentKey,
        attachmentName: input.attachmentName === null ? null : input.attachmentName,
        status: input.status,
      },
      select: this.homeworkSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "homework.updated",
      entityType: "Homework",
      entityId: homework.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(homework),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return homework;
  }

  private async resolveTeacherId(actor: RequestUser, inputTeacherId: string | undefined, tenantId: string) {
    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (!ownTeacherId) {
        throw new ForbiddenException("This account has no teacher profile.");
      }
      return ownTeacherId;
    }

    if (!inputTeacherId) {
      throw new ForbiddenException("teacherId is required.");
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: inputTeacherId, tenantId },
      select: { id: true },
    });
    if (!teacher) {
      throw new ForbiddenException("Teacher is outside of current tenant.");
    }

    return inputTeacherId;
  }

  private async resolveOwnTeacherId(actor: RequestUser) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    });
    return teacher?.id;
  }

  private async assertGroupBelongsToTenant(groupId: string, tenantId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });
    if (!group) {
      throw new ForbiddenException("Group is outside of current tenant.");
    }
  }

  private async assertSubjectBelongsToTenant(subjectId: string, tenantId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId },
      select: { id: true },
    });
    if (!subject) {
      throw new ForbiddenException("Subject is outside of current tenant.");
    }
  }

  private async assertCanAccessHomework(tenantId: string, teacherId: string, groupId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (ownTeacherId !== teacherId) {
        throw new ForbiddenException("You can only manage homework for your own classes.");
      }
    }

    if (actor.role === UserRole.STUDENT) {
      const ownGroupId = await this.resolveOwnStudentGroupId(actor);
      if (ownGroupId !== groupId) {
        throw new ForbiddenException("You can only view assignments for your own group.");
      }
    }

    if (actor.role === UserRole.GUARDIAN) {
      const childGroupIds = await this.resolveOwnChildGroupIds(actor);
      if (!childGroupIds.includes(groupId)) {
        throw new ForbiddenException("You can only view assignments for your own children's group.");
      }
    }
  }

  private async resolveOwnStudentGroupId(actor: RequestUser) {
    const student = await this.prisma.student.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { groupId: true },
    });
    return student?.groupId ?? undefined;
  }

  private async resolveOwnChildIds(actor: RequestUser): Promise<string[]> {
    const guardian = await this.prisma.guardian.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { students: { select: { studentId: true } } },
    });
    return guardian?.students.map((s) => s.studentId) ?? [];
  }

  private async resolveOwnChildGroupIds(actor: RequestUser): Promise<string[]> {
    const childIds = await this.resolveOwnChildIds(actor);
    if (childIds.length === 0) return [];

    const children = await this.prisma.student.findMany({
      where: { id: { in: childIds } },
      select: { groupId: true },
    });
    return [...new Set(children.map((c) => c.groupId).filter((groupId): groupId is string => Boolean(groupId)))];
  }

  private resolveTenantScope(actor: RequestUser, tenantId?: string) {
    if (this.isGlobalAdmin(actor)) {
      return tenantId ?? actor.tenantId;
    }

    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    return actor.tenantId;
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private homeworkSelect() {
    return {
      id: true,
      tenantId: true,
      title: true,
      description: true,
      availableFrom: true,
      dueDate: true,
      cutOffDate: true,
      weight: true,
      type: true,
      allowNavigation: true,
      attachmentKey: true,
      attachmentName: true,
      status: true,
      createdAt: true,
      group: {
        select: {
          id: true,
          name: true,
          grade: true,
          section: true,
          _count: { select: { students: true } },
        },
      },
      subject: {
        select: { id: true, name: true, code: true },
      },
      teacher: {
        select: {
          id: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      _count: {
        select: { submissions: true, marks: true },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
