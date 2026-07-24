import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { runInTenantTransaction } from "../../core/prisma/run-in-tenant-transaction";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import { GenerateReportCardInput } from "./report-cards.schemas";

type ScaleWithBands = {
  name: string;
  minValue: number;
  maxValue: number;
  passingValue: number;
  bands: { label: string; minValue: number; maxValue: number }[];
};

type SubjectLine = {
  subjectId: string;
  subjectName: string;
  final: number | null; // null = sin notas todavía
  label: string | null;
  passing: boolean | null;
};

export type ComputedReportCard = {
  studentId: string;
  academicYearId: string;
  periodId: string | null;
  scaleName: string;
  passingValue: number;
  overallAverage: number | null;
  lines: SubjectLine[];
};

type PreloadedMark = {
  subjectId: string;
  period: number;
  categoryId: string | null;
  value: number;
  maxValue: number;
  homework: { weight: number } | null;
};
type PreloadedCategory = { id: string; subjectId: string; periodId: string; weight: number };

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
  ) {}

  // ── Motor de cálculo ─────────────────────────────────────────────────────
  private clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  private mean(values: number[]) {
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  private bandFor(scale: ScaleWithBands, value: number): string | null {
    return scale.bands.find((b) => value >= b.minValue && value <= b.maxValue)?.label ?? null;
  }

  private toLine(scale: ScaleWithBands, subjectId: string, subjectName: string, fraction: number | null): SubjectLine {
    if (fraction === null) return { subjectId, subjectName, final: null, label: null, passing: null };
    const final = this.clamp(fraction * scale.maxValue, scale.minValue, scale.maxValue);
    const rounded = Math.round(final * 100) / 100;
    return {
      subjectId,
      subjectName,
      final: rounded,
      label: this.bandFor(scale, rounded),
      passing: rounded >= scale.passingValue,
    };
  }

  /**
   * Fracción (0..1) lograda por un estudiante en una materia y periodo, calculada
   * EN MEMORIA sobre las notas y categorías ya precargadas (ver compute()). Usa las
   * categorías ponderadas del profesor si existen; si no (el caso actual, sin UI de
   * categorías todavía), pondera por el peso de cada tarea (`homework.weight`), el
   * MISMO criterio que el preview del frontend (`lib/grading.ts`) para que la vista
   * previa coincida con el boletín oficial. Una nota sin tarea (manual) cuenta con
   * peso 1. null si no hay notas.
   * Antes era una query por (materia × periodo × categoría), lo que producía un N+1
   * severo en la generación masiva.
   */
  private subjectPeriodFraction(
    marks: PreloadedMark[],
    categories: PreloadedCategory[],
    subjectId: string,
    periodId: string,
    periodSequence: number,
  ): number | null {
    const cats = categories.filter((c) => c.subjectId === subjectId && c.periodId === periodId);

    if (cats.length > 0) {
      let weightWithMarks = 0;
      let weightedSum = 0;
      for (const cat of cats) {
        const catMarks = marks.filter((m) => m.categoryId === cat.id);
        if (catMarks.length === 0) continue;
        const catFraction = this.mean(catMarks.map((m) => m.value / m.maxValue));
        weightedSum += catFraction * cat.weight;
        weightWithMarks += cat.weight;
      }
      // Solo la ponderada si al menos una categoría tuvo notas; si no, fallback.
      if (weightWithMarks > 0) return weightedSum / weightWithMarks;
    }

    // Ponderado por el peso de cada tarea, igual que lib/grading.ts. Sin peso
    // (>0) la nota cuenta con peso 1 (equitativo), como en el frontend.
    const periodMarks = marks.filter((m) => m.subjectId === subjectId && m.period === periodSequence);
    if (periodMarks.length === 0) return null;
    let weighted = 0;
    let totalWeight = 0;
    for (const m of periodMarks) {
      const w = m.homework && m.homework.weight > 0 ? m.homework.weight : 1;
      weighted += (m.value / m.maxValue) * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? weighted / totalWeight : null;
  }

  // ── Cálculo de un boletín (periodo o año) sin persistir ──────────────────
  async compute(
    studentId: string,
    actor: RequestUser,
    academicYearId?: string,
    periodId?: string,
  ): Promise<ComputedReportCard> {
    const student = await this.assertCanAccessStudent(studentId, actor);
    const scale = await this.defaultScale(student.tenantId);
    const year = await this.resolveYear(student.tenantId, academicYearId);

    const subjects = await this.studentSubjects(student.groupId);

    // Se precargan en 2 queries todas las notas del alumno en el año y todas las
    // categorías del grupo para los periodos del año; el resto del cálculo es en
    // memoria. Antes cada (materia × periodo × categoría) hacía su propia query.
    const [marks, categories] = student.groupId
      ? await Promise.all([
          this.prisma.mark.findMany({
            where: { studentId, academicYearId: year.id, isPublished: true },
            select: {
              subjectId: true,
              period: true,
              categoryId: true,
              value: true,
              maxValue: true,
              homework: { select: { weight: true } }, // para ponderar por peso de tarea
            },
          }),
          this.prisma.gradingCategory.findMany({
            where: { groupId: student.groupId, periodId: { in: year.periods.map((p) => p.id) } },
            select: { id: true, subjectId: true, periodId: true, weight: true },
          }),
        ])
      : [[] as PreloadedMark[], [] as PreloadedCategory[]];

    if (periodId) {
      const period = year.periods.find((p) => p.id === periodId);
      if (!period) throw new NotFoundException("Period not found in this academic year.");
      const lines: SubjectLine[] = [];
      for (const s of subjects) {
        const fraction = student.groupId
          ? this.subjectPeriodFraction(marks, categories, s.id, period.id, period.sequence)
          : null;
        lines.push(this.toLine(scale, s.id, s.name, fraction));
      }
      return this.pack(studentId, year.id, periodId, scale, lines);
    }

    // Año: definitiva = Σ(periodoFinal × peso) / Σ(peso), por materia.
    const lines: SubjectLine[] = [];
    for (const s of subjects) {
      let weightSum = 0;
      let weighted = 0;
      for (const period of year.periods) {
        if (!student.groupId) continue;
        const fraction = this.subjectPeriodFraction(marks, categories, s.id, period.id, period.sequence);
        if (fraction === null) continue;
        const periodFinal = this.clamp(fraction * scale.maxValue, scale.minValue, scale.maxValue);
        weighted += periodFinal * period.weight;
        weightSum += period.weight;
      }
      // Reproyecta la definitiva de año a fracción para reusar toLine.
      const yearFraction = weightSum > 0 ? weighted / weightSum / scale.maxValue : null;
      lines.push(this.toLine(scale, s.id, s.name, yearFraction));
    }
    return this.pack(studentId, year.id, null, scale, lines);
  }

  private pack(
    studentId: string,
    academicYearId: string,
    periodId: string | null,
    scale: ScaleWithBands,
    lines: SubjectLine[],
  ): ComputedReportCard {
    const finals = lines.map((l) => l.final).filter((v): v is number => v !== null);
    const overall = finals.length > 0 ? Math.round(this.mean(finals) * 100) / 100 : null;
    return {
      studentId,
      academicYearId,
      periodId,
      scaleName: scale.name,
      passingValue: scale.passingValue,
      overallAverage: overall,
      lines,
    };
  }

  // ── Boletín congelado (inmutable) ────────────────────────────────────────
  async generate(input: GenerateReportCardInput, actor: RequestUser, request: Request) {
    const computed = await this.compute(input.studentId, actor, input.academicYearId, input.periodId);
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: input.studentId },
      select: { tenantId: true },
    });

    const existing = await this.prisma.reportCard.findFirst({
      where: {
        tenantId: student.tenantId,
        studentId: input.studentId,
        academicYearId: computed.academicYearId,
        periodId: computed.periodId,
      },
      select: { id: true, status: true },
    });
    if (existing?.status === "FINAL") {
      throw new ForbiddenException("Este boletín ya fue finalizado y no puede regenerarse.");
    }

    const overall = computed.overallAverage ?? 0;
    const buildCard = () =>
      runInTenantTransaction(this.prisma, this.tenantRlsContext, student.tenantId, async (tx) => {
        if (existing) await tx.reportCard.delete({ where: { id: existing.id } });
        return tx.reportCard.create({
          data: {
            tenantId: student.tenantId,
            studentId: input.studentId,
            academicYearId: computed.academicYearId,
            periodId: computed.periodId,
            status: input.status ?? "PUBLISHED",
            overallAverage: overall,
            scaleName: computed.scaleName,
            generatedById: actor.id,
            lines: {
              create: computed.lines
                .filter((l) => l.final !== null)
                .map((l) => ({
                  tenantId: student.tenantId,
                  subjectId: l.subjectId,
                  subjectName: l.subjectName,
                  final: l.final as number,
                  label: l.label ?? "",
                  passing: l.passing ?? false,
                })),
            },
          },
          select: this.cardSelect(),
        });
      });

    let card: Awaited<ReturnType<typeof buildCard>>;
    try {
      card = await buildCard();
    } catch (err) {
      // El @@unique([studentId, academicYearId, periodId]) hace que dos generate()
      // concurrentes del mismo boletín no puedan duplicar: el segundo choca aquí.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("El boletín se está generando en paralelo; reintenta.");
      }
      throw err;
    }

    await this.audit.record({
      tenantId: student.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "report_card.generated",
      entityType: "ReportCard",
      entityId: card.id,
      newValues: JSON.parse(JSON.stringify({ status: card.status, overallAverage: overall })) as Prisma.InputJsonValue,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return card;
  }

  /**
   * Genera boletines para todos los estudiantes activos de un grupo (o del colegio
   * entero si no se pasa groupId). Reutiliza generate() por estudiante para heredar
   * scoping, snapshot y auditoría; los que fallan (p. ej. boletín ya FINAL) se
   * reportan como omitidos en vez de abortar el lote completo.
   */
  async generateBulk(
    input: { tenantId?: string; groupId?: string; academicYearId?: string; periodId?: string; status?: "DRAFT" | "PUBLISHED" | "FINAL" },
    actor: RequestUser,
    request: Request,
  ) {
    // Tenant efectivo: un admin del colegio siempre usa el suyo; un admin global
    // (sin tenantId propio) DEBE pasar uno explícito. Sin esto, el findMany corría
    // sin filtro de tenant y generaba/sobrescribía boletines de TODOS los colegios.
    let targetTenantId: string;
    if (this.isGlobalAdmin(actor)) {
      if (!input.tenantId) {
        throw new ForbiddenException("Un administrador global debe indicar el colegio (tenantId).");
      }
      targetTenantId = input.tenantId;
    } else {
      if (!actor.tenantId) throw new ForbiddenException("Tenant is required.");
      if (input.tenantId && input.tenantId !== actor.tenantId) {
        throw new ForbiddenException("Tenant is outside of current context.");
      }
      targetTenantId = actor.tenantId;
    }

    const students = await this.prisma.student.findMany({
      where: {
        isActive: true,
        tenantId: targetTenantId,
        ...(input.groupId ? { groupId: input.groupId } : { groupId: { not: null } }),
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    const generated: string[] = [];
    const skipped: { studentId: string; studentName: string; reason: string }[] = [];

    for (const student of students) {
      try {
        const card = await this.generate(
          {
            studentId: student.id,
            academicYearId: input.academicYearId,
            periodId: input.periodId,
            status: input.status,
          },
          actor,
          request,
        );
        generated.push(card.id);
      } catch (err) {
        skipped.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          reason: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }

    return { total: students.length, generated: generated.length, skipped };
  }

  async findCard(cardId: string, actor: RequestUser) {
    const card = await this.prisma.reportCard.findUniqueOrThrow({
      where: { id: cardId },
      select: this.cardSelect(),
    });
    await this.assertCanAccessStudent(card.studentId, actor);
    return card;
  }

  async listCards(studentId: string, actor: RequestUser, academicYearId?: string) {
    await this.assertCanAccessStudent(studentId, actor);
    return this.prisma.reportCard.findMany({
      where: { studentId, ...(academicYearId ? { academicYearId } : {}) },
      select: this.cardSelect(),
      orderBy: [{ generatedAt: "desc" }],
    });
  }

  // ── helpers de datos ─────────────────────────────────────────────────────
  private async defaultScale(tenantId: string): Promise<ScaleWithBands> {
    const scale = await this.prisma.gradingScale.findFirst({
      where: { tenantId, isDefault: true },
      select: {
        name: true,
        minValue: true,
        maxValue: true,
        passingValue: true,
        bands: { select: { label: true, minValue: true, maxValue: true }, orderBy: { order: "asc" } },
      },
    });
    if (!scale) {
      throw new ForbiddenException("El colegio no tiene una escala de calificación configurada.");
    }
    return scale;
  }

  private async resolveYear(tenantId: string, academicYearId?: string) {
    const year = academicYearId
      ? await this.prisma.academicYear.findFirst({
          where: { id: academicYearId, tenantId },
          select: { id: true, periods: { select: { id: true, sequence: true, weight: true }, orderBy: { sequence: "asc" } } },
        })
      : await this.prisma.academicYear.findFirst({
          where: { tenantId, isActive: true },
          select: { id: true, periods: { select: { id: true, sequence: true, weight: true }, orderBy: { sequence: "asc" } } },
        });
    if (!year) throw new NotFoundException("No hay un año académico configurado.");
    return year;
  }

  private async studentSubjects(groupId: string | null) {
    if (!groupId) return [];
    const schedules = await this.prisma.schedule.findMany({
      where: { groupId },
      select: { subject: { select: { id: true, name: true } } },
    });
    const map = new Map<string, { id: string; name: string }>();
    for (const s of schedules) map.set(s.subject.id, s.subject);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── scoping por rol ────────────────────────────────────────────────────────
  private async assertCanAccessStudent(studentId: string, actor: RequestUser) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, tenantId: true, groupId: true, userId: true },
    });
    if (!student) throw new NotFoundException("Student not found.");

    if (this.isGlobalAdmin(actor)) return student;
    if (actor.tenantId !== student.tenantId) throw new NotFoundException("Student not found.");

    if (actor.role === UserRole.STUDENT) {
      if (student.userId !== actor.id) throw new ForbiddenException("You can only view your own report card.");
      return student;
    }
    if (actor.role === UserRole.GUARDIAN) {
      const link = await this.prisma.studentGuardian.findFirst({
        where: { studentId, guardian: { userId: actor.id } },
        select: { studentId: true },
      });
      if (!link) throw new ForbiddenException("You can only view your own children's report cards.");
      return student;
    }
    if (actor.role === UserRole.TEACHER) {
      const teaches = student.groupId
        ? await this.prisma.schedule.findFirst({
            where: { groupId: student.groupId, teacher: { userId: actor.id } },
            select: { id: true },
          })
        : null;
      if (!teaches) throw new ForbiddenException("You can only access report cards for your own groups.");
      return student;
    }
    // Roles administrativos del tenant (TENANT_ADMIN, PRINCIPAL, COORDINATOR, SECRETARY)
    return student;
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private cardSelect() {
    return {
      id: true,
      tenantId: true,
      studentId: true,
      academicYearId: true,
      periodId: true,
      status: true,
      overallAverage: true,
      scaleName: true,
      generatedAt: true,
      student: { select: { id: true, firstName: true, lastName: true, documentId: true } },
      period: { select: { id: true, name: true, sequence: true } },
      lines: {
        select: { subjectId: true, subjectName: true, final: true, label: true, passing: true },
        orderBy: { subjectName: "asc" as const },
      },
    };
  }
}
