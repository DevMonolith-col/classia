import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AttendanceStatus, Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  AttendanceAbsenceEvent,
  NOTIFICATION_EVENTS,
} from "../notifications/notifications.events";
import {
  CreateSessionInput,
  ListSessionsQuery,
  SubmitRecordsInput,
  UpdateSessionInput,
} from "./attendance.schemas";

@Injectable()
export class AttendanceService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async listSessions(actor: RequestUser, query: ListSessionsQuery) {
    const dateFilter =
      query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {};
    const commonFilter = {
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.scheduleId ? { scheduleId: query.scheduleId } : {}),
      ...dateFilter,
    };

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherIdIfTeacher(actor);
      if (!ownTeacherId) {
        return [];
      }

      return this.prisma.attendanceSession.findMany({
        where: { teacherId: ownTeacherId, ...commonFilter },
        select: this.sessionSelect(),
        orderBy: [{ date: "desc" }],
      });
    }

    if (actor.role === UserRole.GUARDIAN) {
      const childIds = await this.resolveOwnChildIds(actor);
      if (childIds.length === 0) return [];

      const childGroupIds = await this.resolveOwnChildGroupIds(childIds);
      if (childGroupIds.length === 0) return [];

      const sessions = await this.prisma.attendanceSession.findMany({
        where: { ...commonFilter, groupId: { in: childGroupIds } },
        select: this.sessionSelect(),
        orderBy: [{ date: "desc" }],
      });

      return sessions.map((session) => this.scopeRecordsToChildren(session, childIds));
    }

    const scopedTenantId = this.resolveTenantScope(actor, query.tenantId);

    return this.prisma.attendanceSession.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...commonFilter,
      },
      select: this.sessionSelect(),
      orderBy: [{ date: "desc" }],
    });
  }

  async findSession(sessionId: string, actor: RequestUser) {
    const session = await this.prisma.attendanceSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: this.sessionSelect(),
    });

    await this.assertCanAccessSession(session.tenantId, session.teacher.id, session.group.id, actor);

    if (actor.role === UserRole.GUARDIAN) {
      const childIds = await this.resolveOwnChildIds(actor);
      return this.scopeRecordsToChildren(session, childIds);
    }

    return session;
  }

  async createOrGetSession(input: CreateSessionInput, actor: RequestUser, request: Request) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: input.scheduleId },
      select: { id: true, tenantId: true, groupId: true, teacherId: true },
    });

    if (!schedule) {
      throw new NotFoundException("Schedule not found.");
    }

    if (!this.isGlobalAdmin(actor) && actor.tenantId !== schedule.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    await this.assertCanActForTeacher(schedule.teacherId, actor);

    const date = this.normalizeDate(input.date);

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { scheduleId: schedule.id, date },
      select: this.sessionSelect(),
    });

    if (existing) {
      return existing;
    }

    const students = await this.prisma.student.findMany({
      where: { groupId: schedule.groupId, isActive: true },
      select: { id: true },
    });

    const session = await this.prisma.attendanceSession.create({
      data: {
        tenantId: schedule.tenantId,
        scheduleId: schedule.id,
        groupId: schedule.groupId,
        teacherId: schedule.teacherId,
        date,
        isOpen: true,
        records: {
          create: students.map((student) => ({
            studentId: student.id,
            tenantId: schedule.tenantId,
            status: "PRESENT",
          })),
        },
      },
      select: this.sessionSelect(),
    });

    await this.audit.record({
      tenantId: schedule.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "attendance.session.created",
      entityType: "AttendanceSession",
      entityId: session.id,
      newValues: this.toAuditJson(session),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return session;
  }

  async updateSession(
    sessionId: string,
    input: UpdateSessionInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.attendanceSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: this.sessionSelect(),
    });

    await this.assertCanAccessSession(previous.tenantId, previous.teacher.id, previous.group.id, actor);

    const session = await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { isOpen: input.isOpen },
      select: this.sessionSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "attendance.session.updated",
      entityType: "AttendanceSession",
      entityId: session.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(session),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return session;
  }

  async submitRecords(
    sessionId: string,
    input: SubmitRecordsInput,
    actor: RequestUser,
    request: Request,
  ) {
    const session = await this.prisma.attendanceSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: this.sessionSelect(),
    });

    await this.assertCanAccessSession(session.tenantId, session.teacher.id, session.group.id, actor);

    if (!session.isOpen) {
      throw new ForbiddenException("Attendance session is closed.");
    }

    const studentIds = input.records.map((record) => record.studentId);
    const validStudents = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, groupId: session.group.id },
      select: { id: true },
    });

    if (validStudents.length !== new Set(studentIds).size) {
      throw new ForbiddenException("One or more students are outside of this session's group.");
    }

    await this.prisma.$transaction(
      input.records.map((record) =>
        this.prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId, studentId: record.studentId } },
          update: { status: record.status, observation: record.observation },
          create: {
            sessionId,
            studentId: record.studentId,
            tenantId: session.tenantId,
            status: record.status,
            observation: record.observation,
          },
        }),
      ),
    );

    const updated = await this.prisma.attendanceSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: this.sessionSelect(),
    });

    await this.audit.record({
      tenantId: session.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "attendance.records.updated",
      entityType: "AttendanceSession",
      entityId: sessionId,
      newValues: this.toAuditJson({ records: input.records }),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    for (const record of input.records) {
      if (record.status === AttendanceStatus.ABSENT) {
        this.events.emit(NOTIFICATION_EVENTS.ATTENDANCE_ABSENCE, {
          tenantId: session.tenantId,
          sessionId,
          studentId: record.studentId,
          date: session.date,
        } satisfies AttendanceAbsenceEvent);
      }
    }

    return updated;
  }

  private normalizeDate(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private async resolveOwnTeacherIdIfTeacher(actor: RequestUser) {
    if (actor.role !== UserRole.TEACHER) {
      return undefined;
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    });

    return teacher?.id;
  }

  private async assertCanActForTeacher(teacherId: string, actor: RequestUser) {
    if (this.isGlobalAdmin(actor) || actor.role !== UserRole.TEACHER) {
      return;
    }

    const ownTeacherId = await this.resolveOwnTeacherIdIfTeacher(actor);
    if (ownTeacherId !== teacherId) {
      throw new ForbiddenException("You can only manage attendance for your own classes.");
    }
  }

  private async assertCanAccessSession(tenantId: string, teacherId: string, groupId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }
    await this.assertCanActForTeacher(teacherId, actor);

    if (actor.role === UserRole.GUARDIAN) {
      const childGroupIds = await this.resolveOwnChildGroupIds(await this.resolveOwnChildIds(actor));
      if (!childGroupIds.includes(groupId)) {
        throw new ForbiddenException("You can only view attendance for your own children's group.");
      }
    }
  }

  private async resolveOwnChildIds(actor: RequestUser): Promise<string[]> {
    const guardian = await this.prisma.guardian.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { students: { select: { studentId: true } } },
    });
    return guardian?.students.map((s) => s.studentId) ?? [];
  }

  private async resolveOwnChildGroupIds(childIds: string[]): Promise<string[]> {
    if (childIds.length === 0) return [];

    const children = await this.prisma.student.findMany({
      where: { id: { in: childIds } },
      select: { groupId: true },
    });
    return [...new Set(children.map((c) => c.groupId).filter((groupId): groupId is string => Boolean(groupId)))];
  }

  private scopeRecordsToChildren<T extends { records: Array<{ studentId: string }> }>(
    session: T,
    childIds: string[],
  ): T {
    return { ...session, records: session.records.filter((record) => childIds.includes(record.studentId)) };
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

  private sessionSelect() {
    return {
      id: true,
      tenantId: true,
      date: true,
      isOpen: true,
      createdAt: true,
      group: {
        select: { id: true, name: true, grade: true, section: true },
      },
      schedule: {
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          room: true,
          subject: { select: { id: true, name: true, code: true } },
        },
      },
      teacher: {
        select: {
          id: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      records: {
        select: {
          id: true,
          studentId: true,
          status: true,
          observation: true,
          student: {
            select: { id: true, firstName: true, lastName: true, documentId: true },
          },
        },
        orderBy: [{ student: { firstName: "asc" as const } }, { student: { lastName: "asc" as const } }],
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
