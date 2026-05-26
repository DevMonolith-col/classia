import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type CreateAuditLogInput = {
  tenantId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: input.oldValues,
        newValues: input.newValues,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
