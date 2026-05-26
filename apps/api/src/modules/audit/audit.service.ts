import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { RequestUser } from "../../common/types/request-context";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ListAuditLogsInput } from "./audit.schemas";

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListAuditLogsInput, user: RequestUser) {
    const tenantId = this.resolveTenantScope(input.tenantId, user);
    const where: Prisma.AuditLogWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...this.createdAtRange(input),
    };

    const logs = await this.prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        userId: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        oldValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit + 1,
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasNextPage = logs.length > input.limit;
    const items = hasNextPage ? logs.slice(0, input.limit) : logs;
    const nextCursor = hasNextPage ? items.at(-1)?.id : undefined;

    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor,
      },
    };
  }

  private resolveTenantScope(tenantId: string | undefined, user: RequestUser) {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SUPPORT_AGENT) {
      return tenantId;
    }

    if (tenantId && tenantId !== user.tenantId) {
      throw new ForbiddenException("Audit logs are outside of current tenant.");
    }

    return user.tenantId;
  }

  private createdAtRange(input: ListAuditLogsInput): Prisma.AuditLogWhereInput {
    if (!input.from && !input.to) {
      return {};
    }

    return {
      createdAt: {
        ...(input.from ? { gte: input.from } : {}),
        ...(input.to ? { lte: input.to } : {}),
      },
    };
  }
}
