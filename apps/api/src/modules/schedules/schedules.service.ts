import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { AudienceScopeService } from "../../common/audience/audience-scope.service";
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
    private readonly audience: AudienceScopeService,
  ) {}

  async list(actor: RequestUser, query: ListSchedulesQuery) {
    const scopedTenantId = this.resolveTenantScope(actor, query.tenantId);

    const roleScope = await this.resolveRoleScope(actor);
    if (!roleScope) return [];

    return this.prisma.schedule.findMany({
      where: {
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
        ...(query.groupId ? { groupId: query.groupId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.dayOfWeek !== undefined ? { dayOfWeek: query.dayOfWeek } : {}),
        // Último a propósito: el alcance del rol pisa lo que haya pedido el query, nunca al
        // revés. Un `?teacherId=` ajeno no puede ensanchar lo que el actor ya tenía permitido.
        ...roleScope,
      },
      select: this.scheduleSelect(),
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  /**
   * El horario propio, para los tres portales que preguntan lo mismo con distinta cara:
   * `/profesor/horario`, `/familia/horario` y `/alumno/horario`.
   *
   * Endpoint aparte y no un permiso más sobre `list()` porque `list()` es la ruta de
   * administración: acepta `groupId`, `teacherId` y `tenantId` del query y su contrato es
   * "listame lo que yo filtre". Darle esa puerta a una familia obliga a defender cada
   * parámetro nuevo que alguien le agregue; acá el alcance está en el nombre.
   */
  async listMine(actor: RequestUser) {
    const ownScope = await this.resolveOwnScope(actor);
    if (!ownScope) return [];

    return this.prisma.schedule.findMany({
      where: { tenantId: actor.tenantId, ...ownScope },
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
    await this.assertRoleCanSee(schedule, actor);

    return schedule;
  }

  /**
   * "Mi horario": las clases que el actor dicta si es profesor, las de su grupo si es alumno,
   * las de los grupos de sus hijos si es acudiente. `null` para cualquier otro rol y para
   * quien no tenga cómo resolverlo — un rol de profesor sin ficha `Teacher`, un alumno sin
   * grupo, un acudiente sin hijos vinculados.
   *
   * Que devuelva `null` y no `{}` es lo que hace segura a `/schedules/mine`: un endpoint
   * llamado "mine" que ante la duda muestra el colegio entero es peor que no tenerlo.
   */
  private async resolveOwnScope(actor: RequestUser): Promise<Prisma.ScheduleWhereInput | null> {
    if (actor.role === UserRole.TEACHER) {
      const teacherId = await this.audience.resolveOwnTeacherId(actor);
      return teacherId ? { teacherId } : null;
    }

    if (actor.role === UserRole.STUDENT || actor.role === UserRole.GUARDIAN) {
      const groupIds = await this.audience.resolveUserGroupIds(actor);
      return groupIds.length > 0 ? { groupId: { in: groupIds } } : null;
    }

    return null;
  }

  /**
   * Filtro adicional por rol para la ruta de administración, o `null` si el actor no tiene por
   * qué ver ningún horario.
   *
   * Existe porque `SCHEDULES_LIST` abre la ruta pero no dice **cuánto** de ella: hasta el
   * 2026-07-26 `list()` filtraba solo por tenant, así que cualquier profesor podía listar el
   * horario completo del colegio (y `findOne` leer el de cualquier otro). RLS no atrapa eso —
   * es un IDOR intra-tenant, y las políticas de Postgres defienden contra el filtro olvidado,
   * no contra el rol que pide de más.
   *
   * Devuelve `{}` solo para los roles con alcance de colegio completo: administrativos y
   * soporte, que ya pasaron el guard del permiso.
   */
  private async resolveRoleScope(actor: RequestUser): Promise<Prisma.ScheduleWhereInput | null> {
    if (
      actor.role === UserRole.TEACHER ||
      actor.role === UserRole.STUDENT ||
      actor.role === UserRole.GUARDIAN
    ) {
      return this.resolveOwnScope(actor);
    }

    return {};
  }

  private async assertRoleCanSee(
    schedule: { teacher: { id: string }; group: { id: string } },
    actor: RequestUser,
  ) {
    if (actor.role === UserRole.TEACHER) {
      const teacherId = await this.audience.resolveOwnTeacherId(actor);
      if (teacherId !== schedule.teacher.id) {
        throw new ForbiddenException("You can only view schedules for your own classes.");
      }
      return;
    }

    if (actor.role === UserRole.STUDENT || actor.role === UserRole.GUARDIAN) {
      const groupIds = await this.audience.resolveUserGroupIds(actor);
      if (!groupIds.includes(schedule.group.id)) {
        throw new ForbiddenException("You can only view schedules for your own group.");
      }
    }
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
