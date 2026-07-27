import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  CreateDemoRequestInput,
  ListDemoRequestsQuery,
  UpdateDemoRequestInput,
} from "./demo-requests.schemas";

// Campos que el equipo comercial mira en la bandeja. `internalNotes` está adentro a
// propósito: esta proyección solo la ven endpoints con sesión y permiso.
const demoRequestSelect = {
  id: true,
  schoolName: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  contactRole: true,
  city: true,
  studentCount: true,
  interests: true,
  message: true,
  source: true,
  status: true,
  quotedPlan: true,
  quotedAmount: true,
  quotedCurrency: true,
  quotedAt: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
  handledBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.DemoRequestSelect;

type DemoRequestRow = Prisma.DemoRequestGetPayload<{ select: typeof demoRequestSelect }>;

/**
 * Solicitudes de demo del sitio público, y su seguimiento comercial.
 *
 * Este módulo es la única parte del backend que corre **sin tenant**: la solicitud llega
 * antes de que el colegio exista. Por eso `demo_requests` no tiene RLS (ver la migración
 * 20260727140000_demo_requests y GLOBAL_ALLOWLIST en scripts/verify-rls.ts) y por eso
 * `this.prisma` funciona acá sin `runWithTenant` — la extensión de Prisma simplemente no
 * setea `app.tenant_id` cuando no hay contexto, y la tabla no lo necesita.
 *
 * No usa PlatformAdminPrismaService: ese cliente existe para **saltarse** RLS en tablas que
 * sí lo tienen. Acá no hay nada que saltarse, y usar el bypass sería afirmar un permiso que
 * esta operación no necesita.
 */
@Injectable()
export class DemoRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Endpoint público. **No devuelve nada del registro creado** (201 con cuerpo vacío): si
   * devolviera el id, cualquiera en internet tendría un identificador válido de una fila que
   * solo el equipo interno debería poder nombrar.
   */
  async create(input: CreateDemoRequestInput) {
    await this.prisma.demoRequest.create({
      data: {
        schoolName: input.schoolName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        contactRole: input.contactRole,
        city: input.city,
        studentCount: input.studentCount,
        interests: input.interests ?? [],
        message: input.message,
        source: input.source,
      },
      select: { id: true },
    });
  }

  async list(query: ListDemoRequestsQuery) {
    const rows = await this.prisma.demoRequest.findMany({
      where: query.status ? { status: query.status } : undefined,
      select: demoRequestSelect,
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOne(id: string) {
    const row = await this.prisma.demoRequest.findUnique({
      where: { id },
      select: demoRequestSelect,
    });

    if (!row) {
      throw new NotFoundException("La solicitud no existe.");
    }

    return this.toResponse(row);
  }

  async update(
    id: string,
    input: UpdateDemoRequestInput,
    user: RequestUser,
    request: Request,
  ) {
    const previous = await this.prisma.demoRequest.findUnique({
      where: { id },
      select: demoRequestSelect,
    });

    if (!previous) {
      throw new NotFoundException("La solicitud no existe.");
    }

    const data: Prisma.DemoRequestUpdateInput = {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.quotedPlan !== undefined ? { quotedPlan: input.quotedPlan } : {}),
      ...(input.quotedCurrency !== undefined ? { quotedCurrency: input.quotedCurrency } : {}),
      ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
      ...(input.quotedAmount !== undefined
        ? {
            quotedAmount:
              input.quotedAmount === null ? null : new Prisma.Decimal(input.quotedAmount),
          }
        : {}),
      // Quién la está atendiendo se deriva de quien edita, no se pide aparte: en la práctica
      // el que anota la cotización es el que la mandó.
      handledBy: { connect: { id: user.id } },
    };

    // `quotedAt` es "cuándo se cotizó", no "cuándo se tocó la fila". Se sella la primera vez
    // que aparece un monto y no se vuelve a mover, para que la bandeja pueda mostrar hace
    // cuánto está esperando respuesta el colegio.
    const gotQuotedNow =
      input.quotedAmount !== undefined && input.quotedAmount !== null && !previous.quotedAt;
    if (gotQuotedNow) {
      data.quotedAt = new Date();
    }

    const updated = await this.prisma.demoRequest.update({
      where: { id },
      data,
      select: demoRequestSelect,
    });

    // Auditoría sin tenantId: la acción no ocurre dentro de ningún colegio. `audit_logs`
    // acepta tenantId nulo por diseño (política nullable-tenant, ver
    // 20260722110000_rls_enable_force_policies) — es el mismo caso que una acción de
    // plataforma de un SUPER_ADMIN.
    await this.audit.record({
      userId: user.id,
      actorRole: user.role,
      action: "demo_request.updated",
      entityType: "DemoRequest",
      entityId: id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(updated),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return this.toResponse(updated);
  }

  // Decimal fuera del borde HTTP: Prisma.Decimal se serializa como string y obligaría al
  // frontend a parsear. Mismo criterio que payments.service#collectionRate.
  private toResponse(row: DemoRequestRow) {
    return {
      ...row,
      quotedAmount: row.quotedAmount === null ? null : row.quotedAmount.toNumber(),
    };
  }

  private toAuditJson(row: DemoRequestRow) {
    return JSON.parse(JSON.stringify(this.toResponse(row))) as Prisma.InputJsonValue;
  }
}
