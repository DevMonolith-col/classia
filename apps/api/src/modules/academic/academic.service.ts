import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  CreateAcademicYearInput,
  SetPeriodsInput,
  UpdateAcademicYearInput,
} from "./academic.schemas";

@Injectable()
export class AcademicService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  listYears(actor: RequestUser, tenantId?: string) {
    const scoped = this.resolveTenantScope(actor, tenantId);
    return this.prisma.academicYear.findMany({
      where: scoped ? { tenantId: scoped } : undefined,
      select: this.yearSelect(),
      orderBy: [{ startDate: "desc" }],
    });
  }

  async findYear(yearId: string, actor: RequestUser) {
    const year = await this.prisma.academicYear.findUniqueOrThrow({
      where: { id: yearId },
      select: this.yearSelect(),
    });
    this.assertTenant(year.tenantId, actor);
    return year;
  }

  async createYear(input: CreateAcademicYearInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);
    if (!tenantId) throw new ForbiddenException("Tenant is required for academic years.");

    const year = await this.prisma.academicYear.create({
      data: { tenantId, name: input.name, startDate: input.startDate, endDate: input.endDate },
      select: this.yearSelect(),
    });
    await this.record(actor, request, "academic_year.created", "AcademicYear", year.id, undefined, year);
    return year;
  }

  async updateYear(yearId: string, input: UpdateAcademicYearInput, actor: RequestUser, request: Request) {
    const previous = await this.findYear(yearId, actor);
    const year = await this.prisma.academicYear.update({
      where: { id: yearId },
      data: { name: input.name, startDate: input.startDate, endDate: input.endDate },
      select: this.yearSelect(),
    });
    await this.record(actor, request, "academic_year.updated", "AcademicYear", year.id, previous, year);
    return year;
  }

  // Marca este año como el vigente y desactiva los demás del tenant, en transacción.
  async activateYear(yearId: string, actor: RequestUser, request: Request) {
    const year = await this.findYear(yearId, actor);
    await this.prisma.$transaction([
      this.prisma.academicYear.updateMany({
        where: { tenantId: year.tenantId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.academicYear.update({ where: { id: yearId }, data: { isActive: true } }),
    ]);
    await this.record(actor, request, "academic_year.activated", "AcademicYear", yearId, undefined, undefined);
    return this.findYear(yearId, actor);
  }

  async archiveYear(yearId: string, actor: RequestUser, request: Request) {
    const year = await this.findYear(yearId, actor);
    const updated = await this.prisma.academicYear.update({
      where: { id: yearId },
      data: { status: "ARCHIVED", isActive: false },
      select: this.yearSelect(),
    });
    await this.record(actor, request, "academic_year.archived", "AcademicYear", yearId, year, updated);
    return updated;
  }

  // Reemplaza el conjunto de periodos del año. Bloquea si algún periodo está cerrado.
  async setPeriods(yearId: string, input: SetPeriodsInput, actor: RequestUser, request: Request) {
    const year = await this.findYear(yearId, actor);

    const locked = await this.prisma.academicPeriod.findFirst({
      where: { academicYearId: yearId, lockedAt: { not: null } },
      select: { id: true },
    });
    if (locked) {
      throw new ForbiddenException("No se pueden reconfigurar los periodos: hay periodos cerrados.");
    }

    await this.prisma.$transaction([
      this.prisma.academicPeriod.deleteMany({ where: { academicYearId: yearId } }),
      this.prisma.academicPeriod.createMany({
        data: input.periods.map((p) => ({
          tenantId: year.tenantId,
          academicYearId: yearId,
          name: p.name,
          sequence: p.sequence,
          weight: p.weight,
          startDate: p.startDate,
          endDate: p.endDate,
        })),
      }),
    ]);
    await this.record(actor, request, "academic_periods.set", "AcademicYear", yearId, undefined, {
      count: input.periods.length,
    });
    return this.findYear(yearId, actor);
  }

  async lockPeriod(periodId: string, locked: boolean, actor: RequestUser, request: Request) {
    const period = await this.prisma.academicPeriod.findUniqueOrThrow({
      where: { id: periodId },
      select: { id: true, tenantId: true, lockedAt: true },
    });
    this.assertTenant(period.tenantId, actor);
    const updated = await this.prisma.academicPeriod.update({
      where: { id: periodId },
      data: { lockedAt: locked ? new Date() : null },
      select: this.periodSelect(),
    });
    await this.record(
      actor,
      request,
      locked ? "academic_period.locked" : "academic_period.unlocked",
      "AcademicPeriod",
      periodId,
      undefined,
      undefined,
    );
    return updated;
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private resolveTenantScope(actor: RequestUser, tenantId?: string) {
    if (this.isGlobalAdmin(actor)) return tenantId ?? actor.tenantId;
    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }
    return actor.tenantId;
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) {
      throw new NotFoundException("Not found.");
    }
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private yearSelect() {
    return {
      id: true,
      tenantId: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      isActive: true,
      periods: { select: this.periodSelect(), orderBy: { sequence: "asc" as const } },
    };
  }

  private periodSelect() {
    return {
      id: true,
      name: true,
      sequence: true,
      weight: true,
      startDate: true,
      endDate: true,
      lockedAt: true,
    };
  }

  private async record(
    actor: RequestUser,
    request: Request,
    action: string,
    entityType: string,
    entityId: string,
    oldValues?: unknown,
    newValues?: unknown,
  ) {
    await this.audit.record({
      tenantId: actor.tenantId ?? "",
      userId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      oldValues: oldValues ? (JSON.parse(JSON.stringify(oldValues)) as Prisma.InputJsonValue) : undefined,
      newValues: newValues ? (JSON.parse(JSON.stringify(newValues)) as Prisma.InputJsonValue) : undefined,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }
}
