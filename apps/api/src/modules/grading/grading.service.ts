import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { runInTenantTransaction } from "../../core/prisma/run-in-tenant-transaction";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import {
  CreateScaleInput,
  ListCategoriesQuery,
  SetCategoriesInput,
  UpdateScaleInput,
} from "./grading.schemas";

@Injectable()
export class GradingService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
  ) {}

  // ── Escalas ────────────────────────────────────────────────────────────────
  listScales(actor: RequestUser, tenantId?: string) {
    const scoped = this.resolveTenantScope(actor, tenantId);
    return this.prisma.gradingScale.findMany({
      where: scoped ? { tenantId: scoped } : undefined,
      select: this.scaleSelect(),
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async createScale(input: CreateScaleInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);
    if (!tenantId) throw new ForbiddenException("Tenant is required for grading scales.");

    const scale = await runInTenantTransaction(this.prisma, this.tenantRlsContext, tenantId, async (tx) => {
      if (input.isDefault) {
        await tx.gradingScale.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.gradingScale.create({
        data: {
          tenantId,
          name: input.name,
          minValue: input.minValue,
          maxValue: input.maxValue,
          passingValue: input.passingValue,
          isDefault: input.isDefault ?? false,
          bands: input.bands
            ? { create: input.bands.map((b) => ({ tenantId, label: b.label, minValue: b.minValue, maxValue: b.maxValue, order: b.order })) }
            : undefined,
        },
        select: this.scaleSelect(),
      });
    });
    await this.record(actor, request, "grading_scale.created", "GradingScale", scale.id, undefined, scale);
    return scale;
  }

  async updateScale(scaleId: string, input: UpdateScaleInput, actor: RequestUser, request: Request) {
    const previous = await this.prisma.gradingScale.findUniqueOrThrow({
      where: { id: scaleId },
      select: this.scaleSelect(),
    });
    this.assertTenant(previous.tenantId, actor);

    const scale = await runInTenantTransaction(this.prisma, this.tenantRlsContext, previous.tenantId, async (tx) => {
      if (input.bands) {
        await tx.gradingScaleBand.deleteMany({ where: { scaleId } });
      }
      return tx.gradingScale.update({
        where: { id: scaleId },
        data: {
          name: input.name,
          minValue: input.minValue,
          maxValue: input.maxValue,
          passingValue: input.passingValue,
          bands: input.bands
            ? {
                create: input.bands.map((b) => ({
                  tenantId: previous.tenantId,
                  label: b.label,
                  minValue: b.minValue,
                  maxValue: b.maxValue,
                  order: b.order,
                })),
              }
            : undefined,
        },
        select: this.scaleSelect(),
      });
    });
    await this.record(actor, request, "grading_scale.updated", "GradingScale", scaleId, previous, scale);
    return scale;
  }

  // ── Categorías ponderadas por clase ─────────────────────────────────────────
  async listCategories(actor: RequestUser, query: ListCategoriesQuery) {
    const where: Prisma.GradingCategoryWhereInput = {
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    };

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (!ownTeacherId) return [];
      where.teacherId = ownTeacherId;
    } else {
      where.tenantId = this.resolveTenantScope(actor, query.tenantId);
    }

    return this.prisma.gradingCategory.findMany({
      where,
      select: this.categorySelect(),
      orderBy: [{ name: "asc" }],
    });
  }

  // Reemplaza el esquema de categorías de una clase en un periodo, validando que
  // el profesor dueño realmente dicte esa clase (grupo+materia).
  async setCategories(input: SetCategoriesInput, actor: RequestUser, request: Request) {
    const period = await this.prisma.academicPeriod.findUniqueOrThrow({
      where: { id: input.periodId },
      select: { id: true, tenantId: true, lockedAt: true },
    });
    this.assertTenant(period.tenantId, actor);
    if (period.lockedAt) {
      throw new ForbiddenException("El periodo está cerrado: no se pueden cambiar las categorías.");
    }

    const teacherId = await this.resolveClassTeacher(actor, input, period.tenantId);

    await runInTenantTransaction(this.prisma, this.tenantRlsContext, period.tenantId, async (tx) => {
      await tx.gradingCategory.deleteMany({
        where: { groupId: input.groupId, subjectId: input.subjectId, periodId: input.periodId, teacherId },
      });
      await tx.gradingCategory.createMany({
        data: input.categories.map((c) => ({
          tenantId: period.tenantId,
          groupId: input.groupId,
          subjectId: input.subjectId,
          teacherId,
          periodId: input.periodId,
          name: c.name,
          weight: c.weight,
        })),
      });
    });
    await this.record(actor, request, "grading_categories.set", "GradingCategory", input.periodId, undefined, {
      groupId: input.groupId,
      subjectId: input.subjectId,
      count: input.categories.length,
    });
    return this.listCategories(actor, {
      groupId: input.groupId,
      subjectId: input.subjectId,
      periodId: input.periodId,
      teacherId,
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private async resolveClassTeacher(actor: RequestUser, input: SetCategoriesInput, tenantId: string) {
    let teacherId = input.teacherId;
    if (actor.role === UserRole.TEACHER) {
      const own = await this.resolveOwnTeacherId(actor);
      if (!own) throw new ForbiddenException("This account has no teacher profile.");
      teacherId = own;
    }
    if (!teacherId) throw new ForbiddenException("teacherId is required.");

    // El profesor debe dictar esa clase (existe Schedule para grupo+materia).
    const schedule = await this.prisma.schedule.findFirst({
      where: { tenantId, groupId: input.groupId, subjectId: input.subjectId, teacherId },
      select: { id: true },
    });
    if (!schedule) {
      throw new ForbiddenException("El profesor no dicta esta clase (grupo + materia).");
    }
    return teacherId;
  }

  private async resolveOwnTeacherId(actor: RequestUser) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    });
    return teacher?.id;
  }

  private resolveTenantScope(actor: RequestUser, tenantId?: string) {
    if (this.isGlobalAdmin(actor)) return tenantId ?? actor.tenantId;
    if (tenantId && tenantId !== actor.tenantId) throw new ForbiddenException("Tenant is outside of current context.");
    return actor.tenantId;
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (!this.isGlobalAdmin(actor) && actor.tenantId !== tenantId) throw new NotFoundException("Not found.");
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private scaleSelect() {
    return {
      id: true,
      tenantId: true,
      name: true,
      minValue: true,
      maxValue: true,
      passingValue: true,
      isDefault: true,
      bands: {
        select: { id: true, label: true, minValue: true, maxValue: true, order: true },
        orderBy: { order: "asc" as const },
      },
    };
  }

  private categorySelect() {
    return {
      id: true,
      tenantId: true,
      groupId: true,
      subjectId: true,
      teacherId: true,
      periodId: true,
      name: true,
      weight: true,
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
