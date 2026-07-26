import { ForbiddenException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { runInTenantTransaction } from "../../core/prisma/run-in-tenant-transaction";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
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

/**
 * Cliente por el que se escribe una nota: `this.prisma` fuera de transacción, o el `tx`
 * de `runInTenantTransaction()` adentro. Dentro de una transacción, una query por
 * `this.prisma` toma otra conexión del pool y pierde `app.tenant_id` — con RLS forzado
 * eso no falla ruidosamente, devuelve cero filas. Ver el skill `rls-multitenant`.
 */
type MarkWriteClient = Pick<Prisma.TransactionClient, "mark" | "academicYear" | "auditLog">;

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
  /**
   * Año al que se ancla la nota. Si se omite, se usa el año activo del tenant.
   * Los llamantes que califican una tarea **deben** mandar el año del `Homework`:
   * una tarea de un año cerrado calificada tarde pertenece a SU año, no al activo,
   * o la nota aparecería en el boletín del año equivocado. Sin este campo la nota
   * queda invisible para todas las lecturas — ver el skill `calificaciones`.
   */
  academicYearId?: string | null;
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
    private readonly tenantRlsContext: TenantRlsContextService,
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
   * Escribe la nota y su auditoría a través de `client`, y devuelve si corresponde
   * emitir MARK_PUBLISHED — sin emitirlo. Separar el efecto secundario es lo que
   * permite usar esto dentro de una transacción: emitir antes del commit podría
   * notificarle al alumno una nota que después se revierte.
   */
  private async writeMark(input: MarkWriteInput, actor: MarkWriteActor, client: MarkWriteClient) {
    // El año explícito manda; solo se cae al activo del tenant si el llamante no lo
    // sabe (nota manual suelta). resolveActiveYear() lanza si no hay ninguno activo,
    // que es preferible a escribir la nota con año nulo y que nadie la vea.
    const academicYearId =
      input.academicYearId ?? (await this.resolveActiveYear(input.tenantId, client)).id;

    const data = {
      tenantId: input.tenantId,
      studentId: input.studentId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      homeworkId: input.homeworkId ?? null,
      categoryId: input.categoryId ?? null,
      academicYearId,
      title: input.title,
      value: input.value,
      maxValue: input.maxValue,
      comment: input.comment,
      period: input.period,
      date: input.date,
      isPublished: input.isPublished,
    };

    const previous = input.homeworkId
      ? await client.mark.findUnique({
          where: { studentId_homeworkId: { studentId: input.studentId, homeworkId: input.homeworkId } },
          select: this.markSelect(),
        })
      : null;

    const mark = input.homeworkId
      ? await client.mark.upsert({
          where: { studentId_homeworkId: { studentId: input.studentId, homeworkId: input.homeworkId } },
          create: data,
          update: {
            teacherId: input.teacherId,
            // También en el update: sana una nota que quedó con año nulo antes del
            // arreglo del 2026-07-25, en cuanto se recalifica.
            academicYearId,
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
      : await client.mark.create({ data, select: this.markSelect() });

    await this.audit.record(
      {
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
      },
      client,
    );

    // Notifica solo cuando la nota queda publicada y antes no lo estaba.
    return { mark, shouldPublish: mark.isPublished && !previous?.isPublished };
  }

  /**
   * Fuente única de verdad para escribir una nota. Idempotente para notas ligadas
   * a una tarea vía el índice único [studentId, homeworkId]: reescribir la misma
   * tarea+alumno actualiza en vez de duplicar, cerrando la carrera de los tres
   * writers históricos. Las notas manuales (sin homeworkId) siempre se crean.
   * Registra auditoría y emite MARK_PUBLISHED de forma consistente para cualquier
   * llamante — por eso los otros módulos deben enrutar aquí.
   *
   * Si ya estás dentro de una transacción, usa `upsertMarkInTransaction()`: esta
   * versión escribe por `this.prisma` y perdería el contexto de tenant.
   *
   * `notifyStudent: false` escribe y audita la nota sin avisarle al alumno. Es para
   * cuando el alumno ya está viendo el resultado — la autocalificación de un quiz que
   * él mismo acaba de enviar — donde la notificación llegaría a alguien que ya sabe.
   */
  async upsertMark(
    input: MarkWriteInput,
    actor: MarkWriteActor,
    options: { notifyStudent?: boolean } = {},
  ) {
    const { mark, shouldPublish } = await this.writeMark(input, actor, this.prisma);
    if (shouldPublish && (options.notifyStudent ?? true)) this.emitMarkPublished(mark);
    return mark;
  }

  /**
   * Igual que `upsertMark()` pero escribiendo por el `tx` de una transacción ya
   * abierta con `runInTenantTransaction()`. **El llamante debe invocar el `publish()`
   * devuelto después de que la transacción haga commit** — ahí es donde se emite
   * MARK_PUBLISHED. Emitirlo adentro notificaría notas que un rollback deshace.
   *
   * `notifyStudent: false` escribe la nota y la audita sin avisarle al alumno; sirve
   * para el caso en que el alumno ya está viendo el resultado (autocalificación de un
   * quiz que él mismo acaba de enviar), donde la notificación sería redundante.
   */
  async upsertMarkInTransaction(
    input: MarkWriteInput,
    actor: MarkWriteActor,
    tx: Prisma.TransactionClient,
    options: { notifyStudent?: boolean } = {},
  ) {
    const { mark, shouldPublish } = await this.writeMark(input, actor, tx);
    const notify = options.notifyStudent ?? true;
    return {
      mark,
      publish: () => {
        if (shouldPublish && notify) this.emitMarkPublished(mark);
      },
    };
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

    const created = await runInTenantTransaction(this.prisma, this.tenantRlsContext, tenantId, async (tx) => {
      const results = [];
      for (const record of input.records) {
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
          results.push(
            await tx.mark.upsert({
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
            }),
          );
        } else {
          results.push(await tx.mark.create({ data, select: this.markSelect() }));
        }
      }
      return results;
    });

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

  /**
   * Fallback de año para una nota cuyo llamante no sabe a qué año pertenece (una nota
   * manual suelta). Los que califican una tarea mandan `input.academicYearId` con el
   * año de la tarea: **el año de la tarea manda cuando se conoce**, porque `Mark.date`
   * tiene default `now()` y guiarse por la fecha archivaría en el año equivocado una
   * tarea del año pasado calificada tarde.
   *
   * Lanza si no hay año activo, a propósito: es mejor que escribir la nota con
   * `academicYearId = null`, que la vuelve invisible para todas las lecturas —
   * incluida la del boletín (`report-cards.service.ts`).
   */
  private async resolveActiveYear(tenantId: string, client: MarkWriteClient = this.prisma) {
    const activeYear = await client.academicYear.findFirst({
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
