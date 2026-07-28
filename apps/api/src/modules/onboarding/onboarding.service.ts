import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { MembershipStatus, Prisma, UserRole } from "@prisma/client";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { runInTenantTransaction } from "../../core/prisma/run-in-tenant-transaction";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import {
  ImportResult,
  ImportRowResult,
  StudentImportRow,
  TeacherImportRow,
  studentImportRowSchema,
  teacherImportRowSchema,
} from "./onboarding.schemas";

// Un roster de colegio son cientos de filas, no miles: 2000 es un techo generoso que
// evita que un archivo patológico bloquee el event loop procesando síncronamente.
const MAX_ROWS = 2000;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
  ) {}

  async importTeachers(
    file: Express.Multer.File | undefined,
    actor: RequestUser,
    request: Request,
  ): Promise<ImportResult> {
    const tenantId = this.resolveTenantId(actor);
    const rawRows = this.parseCsv(file);

    const results: ImportRowResult[] = [];

    for (let index = 0; index < rawRows.length; index += 1) {
      const rowNumber = index + 2; // fila 1 es el header
      const parsed = teacherImportRowSchema.safeParse(rawRows[index]);

      if (!parsed.success) {
        results.push({ row: rowNumber, status: "error", message: this.zodMessage(parsed.error) });
        continue;
      }

      try {
        const entityId = await this.createTeacherRow(parsed.data, tenantId, actor, request);
        results.push({ row: rowNumber, status: "ok", message: "Profesor creado.", entityId });
      } catch (err) {
        results.push({ row: rowNumber, status: "error", message: this.friendlyMessage(err) });
      }
    }

    return this.summarize(results);
  }

  async importStudents(
    file: Express.Multer.File | undefined,
    actor: RequestUser,
    request: Request,
  ): Promise<ImportResult> {
    const tenantId = this.resolveTenantId(actor);
    const rawRows = this.parseCsv(file);

    const results: ImportRowResult[] = [];

    for (let index = 0; index < rawRows.length; index += 1) {
      const rowNumber = index + 2;
      const parsed = studentImportRowSchema.safeParse(rawRows[index]);

      if (!parsed.success) {
        results.push({ row: rowNumber, status: "error", message: this.zodMessage(parsed.error) });
        continue;
      }

      try {
        const entityId = await this.createStudentRow(parsed.data, tenantId, actor, request);
        results.push({ row: rowNumber, status: "ok", message: "Estudiante creado.", entityId });
      } catch (err) {
        results.push({ row: rowNumber, status: "error", message: this.friendlyMessage(err) });
      }
    }

    return this.summarize(results);
  }

  private async createTeacherRow(
    row: TeacherImportRow,
    tenantId: string,
    actor: RequestUser,
    request: Request,
  ) {
    return runInTenantTransaction(this.prisma, this.tenantRlsContext, tenantId, async (tx) => {
      const passwordHash = await this.bootstrapPasswordHash();

      const user = await tx.user.create({
        data: {
          email: row.email,
          passwordHash,
          firstName: row.firstName,
          lastName: row.lastName,
          memberships: {
            create: { tenantId, role: UserRole.TEACHER, status: MembershipStatus.ACTIVE },
          },
        },
      });

      const teacher = await tx.teacher.create({
        data: { tenantId, userId: user.id },
      });

      await this.audit.record(
        {
          tenantId,
          userId: actor.id,
          actorRole: actor.role,
          action: "teacher.imported",
          entityType: "Teacher",
          entityId: teacher.id,
          newValues: this.toAuditJson({ userId: user.id, email: user.email }),
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        },
        tx,
      );

      return teacher.id;
    });
  }

  private async createStudentRow(
    row: StudentImportRow,
    tenantId: string,
    actor: RequestUser,
    request: Request,
  ) {
    return runInTenantTransaction(this.prisma, this.tenantRlsContext, tenantId, async (tx) => {
      const group = await tx.group.findFirst({
        where: { tenantId, grade: row.grade, section: row.section },
        select: { id: true },
      });

      if (!group) {
        throw new BadRequestException(`No existe el grupo ${row.grade}-${row.section} en este colegio.`);
      }

      const guardianId = row.guardianEmail
        ? await this.resolveOrCreateGuardian(row, tenantId, actor, request, tx)
        : undefined;

      const student = await tx.student.create({
        data: {
          tenantId,
          firstName: row.firstName,
          lastName: row.lastName,
          documentId: row.documentId,
          birthDate: row.birthDate,
          groupId: group.id,
          guardians: guardianId
            ? { create: [{ guardianId, tenantId }] }
            : undefined,
        },
      });

      await this.audit.record(
        {
          tenantId,
          userId: actor.id,
          actorRole: actor.role,
          action: "student.imported",
          entityType: "Student",
          entityId: student.id,
          newValues: this.toAuditJson(student),
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        },
        tx,
      );

      return student.id;
    });
  }

  // "creación de familias automáticas si aplica": si el acudiente ya existe en el
  // tenant se reusa (solo se agrega el vínculo StudentGuardian); si no existe, se
  // crea la cadena completa User + TenantMembership(GUARDIAN) + Guardian, igual que
  // para un profesor nuevo. docs del plan de este ticket para más contexto.
  private async resolveOrCreateGuardian(
    row: StudentImportRow,
    tenantId: string,
    actor: RequestUser,
    request: Request,
    tx: Prisma.TransactionClient,
  ) {
    const email = row.guardianEmail as string;
    const existingUser = await tx.user.findUnique({ where: { email } });

    if (existingUser) {
      const existingGuardian = await tx.guardian.findFirst({
        where: { userId: existingUser.id, tenantId },
      });
      if (existingGuardian) {
        return existingGuardian.id;
      }

      const hasMembership = await tx.tenantMembership.findFirst({
        where: { userId: existingUser.id, tenantId, role: UserRole.GUARDIAN },
      });
      if (!hasMembership) {
        await tx.tenantMembership.create({
          data: { userId: existingUser.id, tenantId, role: UserRole.GUARDIAN, status: MembershipStatus.ACTIVE },
        });
      }

      const guardian = await tx.guardian.create({
        data: { tenantId, userId: existingUser.id },
      });
      return guardian.id;
    }

    if (!row.guardianFirstName || !row.guardianLastName) {
      throw new BadRequestException(
        "Para crear un acudiente nuevo se requieren guardianFirstName y guardianLastName.",
      );
    }

    const passwordHash = await this.bootstrapPasswordHash();
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: row.guardianFirstName,
        lastName: row.guardianLastName,
        memberships: {
          create: { tenantId, role: UserRole.GUARDIAN, status: MembershipStatus.ACTIVE },
        },
      },
    });

    const guardian = await tx.guardian.create({
      data: { tenantId, userId: newUser.id },
    });

    await this.audit.record(
      {
        tenantId,
        userId: actor.id,
        actorRole: actor.role,
        action: "guardian.imported",
        entityType: "Guardian",
        entityId: guardian.id,
        newValues: this.toAuditJson({ userId: newUser.id, email: newUser.email }),
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      },
      tx,
    );

    return guardian.id;
  }

  // Ni profesores ni acudientes nuevos reciben una contraseña temporal en texto
  // plano (no hay canal seguro para transmitirla hoy). Se genera al azar, nunca se
  // expone ni se loguea, y la cuenta queda utilizable de inmediato vía el flujo real
  // de "¿Olvidaste tu contraseña?" (POST /auth/forgot-password).
  private async bootstrapPasswordHash() {
    const randomPassword = randomBytes(24).toString("base64url");
    return bcrypt.hash(randomPassword, 12);
  }

  private parseCsv(file: Express.Multer.File | undefined): Record<string, string>[] {
    if (!file) {
      throw new BadRequestException("Se requiere un archivo CSV.");
    }

    let rows: Record<string, string>[];
    try {
      rows = parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, string>[];
    } catch {
      throw new BadRequestException("El archivo no es un CSV válido.");
    }

    if (rows.length === 0) {
      throw new BadRequestException("El archivo no contiene filas de datos.");
    }

    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`El archivo supera el límite de ${MAX_ROWS} filas.`);
    }

    return rows;
  }

  private resolveTenantId(actor: RequestUser) {
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant is required for onboarding.");
    }
    return actor.tenantId;
  }

  private summarize(results: ImportRowResult[]): ImportResult {
    const ok = results.filter((r) => r.status === "ok").length;
    return {
      results,
      summary: { total: results.length, ok, failed: results.length - ok },
    };
  }

  private zodMessage(error: { issues: { message: string }[] }) {
    return error.issues.map((issue) => issue.message).join("; ");
  }

  private friendlyMessage(err: unknown): string {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return "Ya existe un usuario con este correo electrónico.";
    }
    if (err instanceof BadRequestException || err instanceof ForbiddenException) {
      const response = err.getResponse();
      return typeof response === "string" ? response : (response as { message?: string }).message ?? err.message;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return "Error desconocido al procesar la fila.";
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
