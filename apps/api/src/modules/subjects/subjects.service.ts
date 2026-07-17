import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateSubjectInput, UpdateSubjectInput } from "./subjects.schemas";

@Injectable()
export class SubjectsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser, tenantId?: string) {
    const scopedTenantId = this.resolveTenantScope(actor, tenantId);

    return this.prisma.subject.findMany({
      where: scopedTenantId ? { tenantId: scopedTenantId } : undefined,
      select: this.subjectSelect(),
      orderBy: { name: "asc" },
    });
  }

  async findOne(subjectId: string, actor: RequestUser) {
    const subject = await this.prisma.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: this.subjectSelect(),
    });

    this.assertCanAccessTenant(subject.tenantId, actor);

    return subject;
  }

  async create(input: CreateSubjectInput, actor: RequestUser, request: Request) {
    const tenantId = this.resolveTenantScope(actor, input.tenantId);

    if (!tenantId) {
      throw new ForbiddenException("Tenant is required for subjects.");
    }

    const subject = await this.prisma.subject.create({
      data: {
        tenantId,
        name: input.name,
        code: input.code,
      },
      select: this.subjectSelect(),
    });

    await this.audit.record({
      tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "subject.created",
      entityType: "Subject",
      entityId: subject.id,
      newValues: this.toAuditJson(subject),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return subject;
  }

  async update(
    subjectId: string,
    input: UpdateSubjectInput,
    actor: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: this.subjectSelect(),
    });

    this.assertCanAccessTenant(previous.tenantId, actor);

    const subject = await this.prisma.subject.update({
      where: { id: subjectId },
      data: {
        name: input.name,
        code: input.code === null ? null : input.code,
      },
      select: this.subjectSelect(),
    });

    await this.audit.record({
      tenantId: previous.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "subject.updated",
      entityType: "Subject",
      entityId: subject.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(subject),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return subject;
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

  private subjectSelect() {
    return {
      id: true,
      tenantId: true,
      name: true,
      code: true,
      _count: {
        select: {
          schedules: true,
          marks: true,
          homework: true,
        },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
