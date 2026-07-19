import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  CreateScheduleInput,
  ListSchedulesQuery,
  UpdateScheduleInput,
} from "./schedules.schemas";

type ScheduleWindow = {
  groupId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

@Injectable()
export class SchedulesService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser, query: ListSchedulesQuery) {
    const scopedTenantId = this.resolveTenantScope(actor, query.tenantId);

    return this.prisma.schedule.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        ...(query.groupId ? { groupId: query.groupId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.dayOfWeek !== undefined ? { dayOfWeek: query.dayOfWeek } : {}),
      },
      select: this.scheduleSelect(),
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async findOne(scheduleId: string, actor: RequestUser) {
    const schedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      select: this.scheduleSelect(),
    });

    this.assertCanAccessTenant(schedule.tenantId, actor);

    return schedule;
  }

  async create(input: CreateScheduleInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for schedules.");
    }

    await this.assertGroupBelongsToTenant(input.groupId, tenantId);
    await this.assertSubjectBelongsToTenant(input.subjectId, tenantId);
    await this.assertTeacherBelongsToTenant(input.teacherId, tenantId);
    await this.assertNoConflicts(tenantId, {
      groupId: input.groupId,
      teacherId: input.teacherId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    const schedule = await this.prisma.schedule.create({
      data: {
        tenantId,
        groupId: input.groupId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
      },
      select: this.scheduleSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "schedule.created",
      entityType: "Schedule",
      entityId: schedule.id,
      newValues: this.toAuditJson(schedule),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return schedule;
  }

  async update(
    scheduleId: string,
    input: UpdateScheduleInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      select: this.scheduleSelect(),
    });

    this.assertCanAccessTenant(previous.tenantId, actor);

    if (input.groupId) {
      await this.assertGroupBelongsToTenant(input.groupId, previous.tenantId);
    }
    if (input.subjectId) {
      await this.assertSubjectBelongsToTenant(input.subjectId, previous.tenantId);
    }
    if (input.teacherId) {
      await this.assertTeacherBelongsToTenant(input.teacherId, previous.tenantId);
    }

    const merged: ScheduleWindow = {
      groupId: input.groupId ?? previous.group.id,
      teacherId: input.teacherId ?? previous.teacher.id,
      dayOfWeek: input.dayOfWeek ?? previous.dayOfWeek,
      startTime: input.startTime ?? previous.startTime,
      endTime: input.endTime ?? previous.endTime,
    };

    await this.assertNoConflicts(previous.tenantId, merged, scheduleId);

    const schedule = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        groupId: input.groupId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room === null ? null : input.room,
      },
      select: this.scheduleSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "schedule.updated",
      entityType: "Schedule",
      entityId: schedule.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(schedule),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return schedule;
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

  private async assertTeacherBelongsToTenant(teacherId: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
      select: { id: true },
    });

    if (!teacher) {
      throw new ForbiddenException("Teacher is outside of current tenant.");
    }
  }

  private async assertNoConflicts(
    tenantId: string,
    window: ScheduleWindow,
    excludeScheduleId?: string,
  ) {
    const overlapping = await this.prisma.schedule.findMany({
      where: {
        tenantId,
        dayOfWeek: window.dayOfWeek,
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
        OR: [{ groupId: window.groupId }, { teacherId: window.teacherId }],
        startTime: { lt: window.endTime },
        endTime: { gt: window.startTime },
      },
      select: { groupId: true, teacherId: true },
    });

    if (overlapping.some((item) => item.groupId === window.groupId)) {
      throw new ConflictException("The group already has a class scheduled in this time range.");
    }
    if (overlapping.some((item) => item.teacherId === window.teacherId)) {
      throw new ConflictException("The teacher already has a class scheduled in this time range.");
    }
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

  private assertCanAccessTenant(tenantId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private scheduleSelect() {
    return {
      id: true,
      tenantId: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      group: {
        select: { id: true, name: true, grade: true, section: true },
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
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
