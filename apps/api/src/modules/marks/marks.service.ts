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

/**
 * Datos para escribir una nota a través del writer único. Los otros módulos que
 * hoy escriben `Mark` directo (homework-submissions, quiz-attempts) deben pasar
 * por `upsertMark()` con esta forma. Ver contrato en
 * docs/planning/asignaciones-calificacion-en-linea.md §2.
 */
export type MarkWriteInput = {
  tenantId: string;
  studentId: string;
  subjectId: string;
  teacherId: string;
  homeworkId?: string | null;
  categoryId?: string | null;
  title: string;
  value: number;
  maxValue?: number;
  comment?: string | null;
  period?: number;
  date?: Date;
  isPublished?: boolean;
};

export type MarkWriteActor = {
  userId: string;
  role: UserRole;
  ipAddress?: string;
  userAgent?: string;
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

  /**
   * Fuente única de verdad para escribir una nota. Idempotente para notas ligadas
   * a una tarea vía el índice único [studentId, homeworkId]: reescribir la misma
   * tarea+alumno actualiza en vez de duplicar, cerrando la carrera de los tres
   * writers históricos. Las notas manuales (sin homeworkId) siempre se crean.
   * Registra auditoría y emite MARK_PUBLISHED de forma consistente para cualquier
   * llamante — por eso los otros módulos deben enrutar aquí.
   */
  async upsertMark(input: MarkWriteInput, actor: MarkWriteActor) {
    const activeYear = await this.resolveActiveYear(input.tenantId);

    const data = {
      tenantId: input.tenantId,
      studentId: input.studentId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      homeworkId: input.homeworkId ?? null,
      categoryId: input.categoryId ?? null,
      academicYearId: activeYear.id,
      title: input.title,
      value: input.value,
      maxValue: input.maxValue,
      comment: input.comment,
      period: input.period,
      date: input.date,
      isPublished: input.isPublished,
    };

    const previous = input.homeworkId
      ? await this.prisma.mark.findUnique({
          where: { studentId_homeworkId: { studentId: input.studentId, homeworkId: input.homeworkId } },
          select: this.markSelect(),
        })
      : null;

    const mark = input.homeworkId
      ? await this.prisma.mark.upsert({
          where: { studentId_homeworkId: { studentId: input.studentId, homeworkId: input.homeworkId } },
          create: data,
          update: {
            teacherId: input.teacherId,
            academicYearId: activeYear.id,
            // undefined = no cambiar; solo se reasigna si el llamante manda un valor.
            categoryId: input.categoryId,
            title: input.title,
            value: input.value,
            maxValue: input.maxValue,
            comment: input.comment,
            period: input.period,
            date: input.date,
            isPublished: input.isPublished,
          },
          select: this.markSelect(),
        })
      : await this.prisma.mark.create({ data, select: this.markSelect() });

    await this.audit.record({
      tenantId: input.tenantId,
      userId: actor.userId,
      actorRole: actor.role,
      action: previous ? "mark.updated" : "mark.created",
      entityType: "Mark",
      entityId: mark.id,
      oldValues: previous ? this.toAuditJson(previous) : undefined,
      newValues: this.toAuditJson(mark),
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    // Notifica solo cuando la nota queda publicada y antes no lo estaba.
    if (mark.isPublished && !previous?.isPublished) {
      this.emitMarkPublished(mark);
    }

    return mark;
  }

  async list(actor: RequestUser, query: ListMarksQuery) {
    let targetYearId = query.academicYearId;
    if (!targetYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId: this.resolveTenantScope(actor, query.tenantId) ?? actor.tenantId, isActive: true },
      });
      targetYearId = activeYear?.id;
    }

    const commonFilter = {
      ...(targetYearId ? { academicYearId: targetYearId } : {}),
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

    return this.upsertMark(
      {
        tenantId,
        studentId: input.studentId,
        subjectId: input.subjectId,
        teacherId,
        homeworkId: input.homeworkId,
        categoryId: input.categoryId,
        title: input.title,
        value: input.value,
        maxValue: input.maxValue,
        comment: input.comment,
        period: input.period,
        date: input.date,
        isPublished: input.isPublished,
      },
      { userId: actor.id, role: actor.role, ipAddress: request.ip, userAgent: request.headers["user-agent"] },
    );
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
        categoryId: input.categoryId,
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

    const activeYear = await this.resolveActiveYear(tenantId);

    const created = await this.prisma.$transaction(
      input.records.map((record) => {
        const data = {
          tenantId,
          studentId: record.studentId,
          subjectId: input.subjectId,
          teacherId,
          academicYearId: activeYear.id,
          homeworkId: input.homeworkId,
          categoryId: input.categoryId,
          title: input.title,
          value: record.value,
          maxValue: input.maxValue,
          period: input.period,
          date: input.date,
          isPublished: input.isPublished,
        };
        // Idempotente por (alumno, tarea) cuando la carga es de una tarea; así
        // recalificar un grupo entero no genera notas duplicadas.
        if (input.homeworkId) {
          return this.prisma.mark.upsert({
            where: { studentId_homeworkId: { studentId: record.studentId, homeworkId: input.homeworkId } },
            create: data,
            update: {
              teacherId,
              academicYearId: activeYear.id,
              categoryId: input.categoryId,
              title: input.title,
              value: record.value,
              maxValue: input.maxValue,
              period: input.period,
              date: input.date,
              isPublished: input.isPublished,
            },
            select: this.markSelect(),
          });
        }
        return this.prisma.mark.create({ data, select: this.markSelect() });
      }),
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

  // Toda escritura de Mark queda anclada al año académico activo del tenant; sin
  // año activo no se puede calificar (los históricos viven en años archivados).
  private async resolveActiveYear(tenantId: string) {
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    });
    if (!activeYear) {
      throw new ForbiddenException("No hay un año académico activo para este colegio.");
    }
    return activeYear;
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

  private markSelect() {
    return {
      id: true,
      tenantId: true,
      homeworkId: true,
      categoryId: true,
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
