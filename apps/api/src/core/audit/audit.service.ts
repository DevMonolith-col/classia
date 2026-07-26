import { Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type CreateAuditLogInput = {
  tenantId?: string;
  userId?: string;
  actorRole?: UserRole;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Cliente por el que se escribe la bitácora. Cuando la acción auditada ocurre dentro
 * de una transacción, hay que pasar el `tx`: `audit_logs` tiene FORCE ROW LEVEL
 * SECURITY, y una escritura por `this.prisma` con una transacción abierta toma otra
 * conexión del pool, sin `app.tenant_id`, así que la política la rechaza. Pasar el `tx`
 * además hace que la auditoría sea atómica con lo auditado: no queda registro de un
 * cambio que después se revierte. Ver docs/planning/aislamiento-rls-multitenant.md,
 * trampa #3.
 */
type AuditWriteClient = Pick<Prisma.TransactionClient, "auditLog">;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: CreateAuditLogInput, client: AuditWriteClient = this.prisma) {
    return client.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        actorRole: input.actorRole,
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
