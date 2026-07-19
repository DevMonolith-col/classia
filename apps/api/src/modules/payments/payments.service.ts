import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InvoiceStatus, Prisma } from "@prisma/client"
import { Request } from "express"
import { RequestUser } from "../../common/types/request-context"
import { AuditService } from "../../core/audit/audit.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { CreateFeeConceptInput, FinancialSummaryQuery, ListInvoicesQuery, RecordPaymentInput } from "./payments.schemas"

const FEE_CONCEPT_LIST_PAGE_SIZE = 200
const INVOICE_LIST_PAGE_SIZE = 500
const OVERDUE_STUDENTS_LIMIT = 100
// Tope defensivo para la consulta de cartera vencida: los totales se calculan por
// agregación en BD (exactos), pero la lista de morosos necesita el saldo por
// factura, así que se acota a este número de facturas vencidas más antiguas.
const OVERDUE_QUERY_CAP = 2000

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  // ─── Conceptos de cobro ──────────────────────────────────────────────────────

  async createFeeConcept(actor: RequestUser, data: CreateFeeConceptInput, request: Request) {
    this.assertTenant(actor)

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: data.academicYearId, tenantId: actor.tenantId },
      select: { id: true },
    })
    if (!academicYear) throw new BadRequestException("El año académico no pertenece a este colegio")

    if (data.groupId) {
      const group = await this.prisma.group.findFirst({ where: { id: data.groupId, tenantId: actor.tenantId }, select: { id: true } })
      if (!group) throw new BadRequestException("El curso no pertenece a este colegio")
    }

    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId, isActive: true, ...(data.groupId ? { groupId: data.groupId } : {}) },
      select: { id: true },
    })

    // El concepto y sus facturas se crean atómicamente: sin transacción, si el
    // createMany fallaba quedaba un concepto de cobro sin facturas (estado parcial).
    const feeConcept = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feeConcept.create({
        data: {
          tenantId: actor.tenantId!,
          academicYearId: data.academicYearId,
          groupId: data.groupId ?? null,
          name: data.name,
          description: data.description,
          amount: data.amount,
          dueDate: data.dueDate,
          createdById: actor.id,
        },
      })

      if (students.length > 0) {
        await tx.invoice.createMany({
          data: students.map((s) => ({
            tenantId: actor.tenantId!,
            studentId: s.id,
            feeConceptId: created.id,
            academicYearId: data.academicYearId,
            concept: data.name,
            amount: data.amount,
            dueDate: data.dueDate,
          })),
        })
      }

      return created
    })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "payments.fee_concept_created",
      entityType: "FeeConcept",
      entityId: feeConcept.id,
      newValues: { name: feeConcept.name, amount: data.amount, studentsInvoiced: students.length },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return { ...feeConcept, studentsInvoiced: students.length }
  }

  async listFeeConcepts(actor: RequestUser) {
    this.assertTenant(actor)
    return this.prisma.feeConcept.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: "desc" },
      take: FEE_CONCEPT_LIST_PAGE_SIZE,
      include: {
        academicYear: { select: { name: true } },
        group: { select: { name: true, grade: true, section: true } },
        _count: { select: { invoices: true } },
      },
    })
  }

  // ─── Facturas ────────────────────────────────────────────────────────────────

  async listInvoices(actor: RequestUser, filters: ListInvoicesQuery) {
    this.assertTenant(actor)
    return this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.groupId ? { student: { groupId: filters.groupId } } : {}),
      },
      orderBy: { dueDate: "desc" },
      take: INVOICE_LIST_PAGE_SIZE,
      include: {
        student: { select: { firstName: true, lastName: true, group: { select: { grade: true, section: true } } } },
        payments: { select: { amount: true } },
      },
    })
  }

  // Self-service: el propio estudiante o su acudiente ven el estado de cuenta.
  async getStudentBalance(studentId: string, actor: RequestUser) {
    await this.assertCanAccessStudent(studentId, actor)

    return this.prisma.invoice.findMany({
      where: { studentId },
      orderBy: { dueDate: "desc" },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    })
  }

  async recordPayment(invoiceId: string, actor: RequestUser, data: RecordPaymentInput, request: Request) {
    const invoice = await this.findInvoiceOrThrow(invoiceId, actor.tenantId)
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException("No se puede registrar un pago sobre una factura cancelada")
    }

    const amount = new Prisma.Decimal(data.amount)

    // Toda la operación (leer saldo → validar → registrar pago → recalcular estado)
    // va en una transacción con lock de fila sobre la factura (FOR UPDATE): así dos
    // pagos simultáneos no pueden ambos pasar la validación de sobrepago ni dejar
    // el estado/monto inconsistente (antes: pago > saldo dejaba totalPending
    // negativo y collectionRate > 100%).
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`

      const agg = await tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } })
      const paidBefore = agg._sum.amount ?? new Prisma.Decimal(0)
      const remaining = invoice.amount.minus(paidBefore)
      if (amount.gt(remaining)) {
        throw new BadRequestException(
          `El pago (${amount.toFixed(2)}) excede el saldo pendiente (${remaining.toFixed(2)}).`,
        )
      }

      await tx.payment.create({
        data: {
          tenantId: actor.tenantId!,
          invoiceId,
          amount,
          method: data.method,
          paidAt: data.paidAt ?? new Date(),
          reference: data.reference,
          recordedById: actor.id,
        },
      })

      const paidSoFar = paidBefore.plus(amount)
      const nextStatus = paidSoFar.gte(invoice.amount)
        ? InvoiceStatus.PAID
        : paidSoFar.gt(0)
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.PENDING

      return tx.invoice.update({ where: { id: invoiceId }, data: { status: nextStatus } })
    })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "payments.payment_recorded",
      entityType: "Invoice",
      entityId: invoiceId,
      newValues: { amount: data.amount, method: data.method, resultingStatus: updated.status },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  async cancelInvoice(invoiceId: string, actor: RequestUser, request: Request) {
    const invoice = await this.findInvoiceOrThrow(invoiceId, actor.tenantId)
    if (invoice.payments.length > 0) {
      throw new BadRequestException("No se puede cancelar una factura con pagos registrados")
    }
    if (invoice.status === InvoiceStatus.CANCELLED) return invoice

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() },
    })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "payments.invoice_cancelled",
      entityType: "Invoice",
      entityId: invoiceId,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  // ─── Resumen financiero (consumido por el reporte financiero) ────────────────

  async getFinancialSummary(actor: RequestUser, filters: FinancialSummaryQuery) {
    this.assertTenant(actor)

    const dueDateRange =
      filters.from || filters.to
        ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) }
        : undefined

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      tenantId: actor.tenantId,
      status: { not: InvoiceStatus.CANCELLED },
      ...(filters.groupId ? { student: { groupId: filters.groupId } } : {}),
      ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
      ...(dueDateRange ? { dueDate: dueDateRange } : {}),
    }

    // Totales exactos por agregación en BD — sin cargar ninguna factura en memoria
    // (antes se traían TODAS las del tenant con sus pagos incluidos).
    const now = new Date()
    const [invoiceAgg, paymentAgg, overdueInvoices] = await Promise.all([
      this.prisma.invoice.aggregate({ where: invoiceWhere, _sum: { amount: true }, _count: true }),
      this.prisma.payment.aggregate({ where: { invoice: invoiceWhere }, _sum: { amount: true } }),
      // Cartera vencida: solo facturas vencidas y sin saldar (subconjunto acotado),
      // con sus pagos para poder calcular el saldo por factura.
      this.prisma.invoice.findMany({
        where: {
          ...invoiceWhere,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL] },
          dueDate: { ...(dueDateRange ?? {}), lt: now },
        },
        include: {
          payments: { select: { amount: true } },
          student: { select: { firstName: true, lastName: true, group: { select: { grade: true, section: true } } } },
        },
        orderBy: { dueDate: "asc" },
        take: OVERDUE_QUERY_CAP,
      }),
    ])

    const totalInvoiced = invoiceAgg._sum.amount ?? new Prisma.Decimal(0)
    const totalCollected = paymentAgg._sum.amount ?? new Prisma.Decimal(0)
    const totalPending = totalInvoiced.minus(totalCollected)
    const collectionRate = totalInvoiced.gt(0) ? totalCollected.dividedBy(totalInvoiced).times(100).toDecimalPlaces(1) : new Prisma.Decimal(0)

    const overdue = overdueInvoices
      .map((invoice) => {
        const paid = invoice.payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0))
        return {
          studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
          groupName: invoice.student.group ? `${invoice.student.group.grade}${invoice.student.group.section}` : "Sin grupo",
          owed: invoice.amount.minus(paid),
          dueDate: invoice.dueDate,
        }
      })
      .filter((row) => row.owed.gt(0))
      .sort((a, b) => (b.owed.gt(a.owed) ? 1 : b.owed.lt(a.owed) ? -1 : 0))
      .slice(0, OVERDUE_STUDENTS_LIMIT)
      .map((row) => ({ ...row, owed: row.owed.toFixed(2) }))

    return {
      totalInvoiced: totalInvoiced.toFixed(2),
      totalCollected: totalCollected.toFixed(2),
      totalPending: totalPending.toFixed(2),
      collectionRate: collectionRate.toNumber(),
      invoiceCount: invoiceAgg._count,
      overdueStudents: overdue,
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findInvoiceOrThrow(invoiceId: string, tenantId: string | undefined) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { id: true } } },
    })
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException("Factura no encontrada")
    }
    return invoice
  }

  private async assertCanAccessStudent(studentId: string, actor: RequestUser) {
    const ownStudent = await this.prisma.student.findFirst({
      where: { id: studentId, userId: actor.id },
      select: { id: true },
    })
    if (ownStudent) return

    const guardianLink = await this.prisma.studentGuardian.findFirst({
      where: { studentId, guardian: { userId: actor.id } },
      select: { studentId: true },
    })
    if (guardianLink) return

    throw new ForbiddenException("No tenés acceso al estado de cuenta de este estudiante")
  }

  private assertTenant(actor: RequestUser): asserts actor is RequestUser & { tenantId: string } {
    if (!actor.tenantId) {
      throw new ForbiddenException("Se requiere un colegio para gestionar pagos")
    }
  }
}
