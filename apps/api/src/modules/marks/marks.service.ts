import { ForbiddenException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  MarkPublishedEvent,
  NOTIFICATION_EVENTS,
} from "../notifications/notifications.events";
import {
  BulkCreateMarksInput,
  CreateMarkInput,
  ListMarksQuery,
  UpdateMarkInput,
} from "./marks.schemas";

type PublishableMark = {
  id: string;
  tenantId: string;
  title: string;
  value: number;
  maxValue: number;
  isPublished: boolean;
  student: { id: string };
  subject: { name: string };
};

@Injectable()
export class MarksService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private emitMarkPublished(mark: PublishableMark) {
    if (!mark.isPublished) return;
    this.events.emit(NOTIFICATION_EVENTS.MARK_PUBLISHED, {
      tenantId: mark.tenantId,
      markId: mark.id,
      studentId: mark.student.id,
      subjectName: mark.subject.name,
      markTitle: mark.title,
      value: mark.value,
      maxValue: mark.maxValue,
    } satisfies MarkPublishedEvent);
  }

  async list(actor: RequestUser, query: ListMarksQuery) {
    const commonFilter = {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.homeworkId ? { homeworkId: query.homeworkId } : {}),
      ...(query.period !== undefined ? { period: query.period } : {}),
      ...(query.groupId ? { student: { groupId: query.groupId } } : {}),
    };

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (!ownTeacherId) return [];

      return this.prisma.mark.findMany({
        where: { teacherId: ownTeacherId, ...commonFilter },
        select: this.markSelect(),
        orderBy: [{ date: "desc" }],
      });
    }

    if (actor.role === UserRole.STUDENT) {
      const ownStudentId = await this.resolveOwnStudentId(actor);
      if (!ownStudentId) return [];

      return this.prisma.mark.findMany({
        where: { ...commonFilter, studentId: ownStudentId },
        select: this.markSelect(),
        orderBy: [{ date: "desc" }],
      });
    }

    if (actor.role === UserRole.GUARDIAN) {
      const childIds = await this.resolveOwnChildIds(actor);
      if (childIds.length === 0) return [];

      return this.prisma.mark.findMany({
        where: { ...commonFilter, studentId: { in: childIds } },
        select: this.markSelect(),
        orderBy: [{ date: "desc" }],
      });
    }

    const scopedTenantId = this.resolveTenantScope(actor, query.tenantId);

    return this.prisma.mark.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...commonFilter,
      },
      select: this.markSelect(),
      orderBy: [{ date: "desc" }],
    });
  }

  async findOne(markId: string, actor: RequestUser) {
    const mark = await this.prisma.mark.findUniqueOrThrow({
      where: { id: markId },
      select: this.markSelect(),
    });

    await this.assertCanAccessMark(mark.tenantId, mark.teacher.id, mark.student.id, actor);

    return mark;
  }

  async create(input: CreateMarkInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for marks.");
    }

    const teacherId = await this.resolveTeacherId(actor, input.teacherId, tenantId);

    await this.assertStudentBelongsToTenant(input.studentId, tenantId);
    await this.assertSubjectBelongsToTenant(input.subjectId, tenantId);
    if (input.homeworkId) {
      await this.assertHomeworkMatches(input.homeworkId, tenantId, input.subjectId);
    }

    const mark = await this.prisma.mark.create({
      data: {
        tenantId,
        studentId: input.studentId,
        subjectId: input.subjectId,
        teacherId,
        homeworkId: input.homeworkId,
        title: input.title,
        value: input.value,
        maxValue: input.maxValue,
        comment: input.comment,
        period: input.period,
        date: input.date,
        isPublished: input.isPublished,
      },
      select: this.markSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "mark.created",
      entityType: "Mark",
      entityId: mark.id,
      newValues: this.toAuditJson(mark),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    this.emitMarkPublished(mark);

    return mark;
  }

  async update(markId: string, input: UpdateMarkInput, actor: RequestUser, request: Request) {
    const previous = await this.prisma.mark.findUniqueOrThrow({
      where: { id: markId },
      select: this.markSelect(),
    });

    await this.assertCanAccessMark(previous.tenantId, previous.teacher.id, previous.student.id, actor);

    const nextValue = input.value ?? previous.value;
    const nextMaxValue = input.maxValue ?? previous.maxValue;
    if (nextValue > nextMaxValue) {
      throw new ForbiddenException("value cannot exceed maxValue.");
    }

    const mark = await this.prisma.mark.update({
      where: { id: markId },
      data: {
        title: input.title,
        value: input.value,
        maxValue: input.maxValue,
        comment: input.comment === null ? null : input.comment,
        period: input.period,
        date: input.date,
        isPublished: input.isPublished,
      },
      select: this.markSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "mark.updated",
      entityType: "Mark",
      entityId: mark.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(mark),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    // Notificar solo cuando la nota pasa de no publicada a publicada.
    if (!previous.isPublished && mark.isPublished) {
      this.emitMarkPublished(mark);
    }

    return mark;
  }

  async bulkCreate(input: BulkCreateMarksInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for marks.");
    }

    const teacherId = await this.resolveTeacherId(actor, input.teacherId, tenantId);

    const group = await this.prisma.group.findFirst({
      where: { id: input.groupId, tenantId },
      select: { id: true },
    });
    if (!group) {
      throw new ForbiddenException("Group is outside of current tenant.");
    }

    await this.assertSubjectBelongsToTenant(input.subjectId, tenantId);
    if (input.homeworkId) {
      await this.assertHomeworkMatches(input.homeworkId, tenantId, input.subjectId, input.groupId);
    }

    const maxValue = input.maxValue ?? 100;
    const invalid = input.records.find((record) => record.value > maxValue);
    if (invalid) {
      throw new ForbiddenException("One or more values exceed maxValue.");
    }

    const studentIds = input.records.map((record) => record.studentId);
    const validStudents = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, groupId: input.groupId },
      select: { id: true },
    });
    if (validStudents.length !== new Set(studentIds).size) {
      throw new ForbiddenException("One or more students are outside of this group.");
    }

    const created = await this.prisma.$transaction(
      input.records.map((record) =>
        this.prisma.mark.create({
          data: {
            tenantId,
            studentId: record.studentId,
            subjectId: input.subjectId,
            teacherId,
            homeworkId: input.homeworkId,
            title: input.title,
            value: record.value,
            maxValue: input.maxValue,
            period: input.period,
            date: input.date,
            isPublished: input.isPublished,
          },
          select: this.markSelect(),
        }),
      ),
    );

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "mark.bulk_created",
      entityType: "Mark",
      entityId: input.groupId,
      newValues: this.toAuditJson({ title: input.title, subjectId: input.subjectId, count: created.length }),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    for (const mark of created) {
      this.emitMarkPublished(mark);
    }

    return created;
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

  private async assertStudentBelongsToTenant(studentId: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) {
      throw new ForbiddenException("Student is outside of current tenant.");
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

  private async assertHomeworkMatches(
    homeworkId: string,
    tenantId: string,
    subjectId: string,
    groupId?: string,
  ) {
    const homework = await this.prisma.homework.findFirst({
      where: { id: homeworkId, tenantId, subjectId, ...(groupId ? { groupId } : {}) },
      select: { id: true },
    });
    if (!homework) {
      throw new ForbiddenException("Homework does not match this tenant, subject, or group.");
    }
  }

  private async assertCanAccessMark(tenantId: string, teacherId: string, studentId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (ownTeacherId !== teacherId) {
        throw new ForbiddenException("You can only manage marks for your own classes.");
      }
    }

    if (actor.role === UserRole.STUDENT) {
      const ownStudentId = await this.resolveOwnStudentId(actor);
      if (ownStudentId !== studentId) {
        throw new ForbiddenException("You can only view your own marks.");
      }
    }

    if (actor.role === UserRole.GUARDIAN) {
      const childIds = await this.resolveOwnChildIds(actor);
      if (!childIds.includes(studentId)) {
        throw new ForbiddenException("You can only view your own children's marks.");
      }
    }
  }

  private async resolveOwnStudentId(actor: RequestUser) {
    const student = await this.prisma.student.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    });
    return student?.id;
  }

  private async resolveOwnChildIds(actor: RequestUser): Promise<string[]> {
    const guardian = await this.prisma.guardian.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { students: { select: { studentId: true } } },
    });
    return guardian?.students.map((s) => s.studentId) ?? [];
  }

  private resolveTenantScope(actor: RequestUser, tenantId?: string) {
    if (this.isGlobalAdmin(actor)) {
      return tenantId;
    }

    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    return actor.tenantId;
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private markSelect() {
    return {
      id: true,
      tenantId: true,
      homeworkId: true,
      title: true,
      value: true,
      maxValue: true,
      comment: true,
      period: true,
      date: true,
      isPublished: true,
      student: {
        select: { id: true, firstName: true, lastName: true, documentId: true, groupId: true },
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
      homework: {
        select: { id: true, title: true, weight: true },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
