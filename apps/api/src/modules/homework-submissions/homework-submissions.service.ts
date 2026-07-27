import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { AudienceScopeService } from "../../common/audience/audience-scope.service";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { runInTenantTransaction } from "../../core/prisma/run-in-tenant-transaction";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import { StorageService } from "../../core/storage/storage.service";
import { MarksService } from "../marks/marks.service";
import { GradeSubmissionInput, SubmitHomeworkInput } from "./homework-submissions.schemas";

@Injectable()
export class HomeworkSubmissionsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
    private readonly marks: MarksService,
    private readonly audience: AudienceScopeService,
    private readonly storage: StorageService,
  ) {}

  async upsertMine(
    homeworkId: string,
    input: SubmitHomeworkInput,
    actor: RequestUser,
    request: Request,
  ) {
    const student = await this.resolveStudent(actor);
    const homework = await this.assertAccessible(homeworkId, student);

    const now = new Date();
    if (homework.availableFrom && now < homework.availableFrom) {
      throw new ForbiddenException("This assignment is not open for submissions yet.");
    }
    if (homework.cutOffDate && now > homework.cutOffDate) {
      throw new ForbiddenException("The submission window for this assignment has closed.");
    }

    const status = now > homework.dueDate ? "LATE" : "SUBMITTED";

    const submission = await this.prisma.homeworkSubmission.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId: student.id } },
      create: {
        homeworkId,
        studentId: student.id,
        tenantId: student.tenantId,
        status,
        attachmentKey: input.attachmentKey,
        attachmentName: input.attachmentName,
        submittedAt: now,
      },
      update: {
        status,
        attachmentKey: input.attachmentKey,
        attachmentName: input.attachmentName,
        submittedAt: now,
      },
      select: this.submissionSelect(),
    });

    await this.audit.record({
      tenantId: student.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "homework_submission.submitted",
      entityType: "HomeworkSubmission",
      entityId: submission.id,
      newValues: this.toAuditJson(submission),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return submission;
  }

  async findMine(homeworkId: string, actor: RequestUser) {
    const student = await this.resolveStudent(actor);

    return this.prisma.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId: student.id } },
      select: this.submissionSelect(),
    });
  }

  /**
   * La entrega de un estudiante propio: el hijo si el actor es acudiente, uno mismo si es
   * alumno. Es lo que sostiene a `familia/tareas`.
   *
   * **`/me` no servía para esto**: `findMine` resuelve la fila `Student` por el `userId` del
   * actor, y un acudiente no tiene ninguna — lanza "This account has no student profile.".
   * El plan de asignaciones (§6, paso 14) daba por hecho que alcanzaba con concederle
   * `HOMEWORK_SUBMISSIONS_READ`, y no: hacía falta esta ruta.
   *
   * **Devuelve URLs firmadas en vez de las keys**, y por eso el acudiente no necesita
   * `FILES_READ`. `FilesService#getDownloadUrl` solo valida que la key empiece con el prefijo
   * del tenant: no tiene noción de dueño del archivo, así que ese permiso es "descargar
   * cualquier archivo del colegio cuya key conozcas". Firmar acá deja el alcance atado a la
   * entrega que el actor ya probó poder ver.
   */
  async findForOwnStudent(homeworkId: string, studentId: string, actor: RequestUser) {
    const ownStudentIds = await this.audience.resolveOwnStudentIds(actor);
    if (!ownStudentIds.includes(studentId)) {
      throw new ForbiddenException("You can only view your own children's submissions.");
    }

    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { id: true, tenantId: true, groupId: true },
    });
    // Valida de paso que la tarea sea del grupo del estudiante: sin esto, un homeworkId de otro
    // curso devolvería null y ese null ya diría que la tarea existe.
    await this.assertAccessible(homeworkId, student);

    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId } },
      select: this.submissionSelect(),
    });
    if (!submission) return null;

    const { attachmentKey, feedbackKey, ...rest } = submission;

    return {
      ...rest,
      attachmentUrl: attachmentKey ? await this.storage.getSignedDownloadUrl(attachmentKey) : null,
      feedbackUrl: feedbackKey ? await this.storage.getSignedDownloadUrl(feedbackKey) : null,
    };
  }

  async listForHomework(homeworkId: string, actor: RequestUser) {
    await this.getHomeworkForTeacherCheck(homeworkId, actor);

    return this.prisma.homeworkSubmission.findMany({
      where: { homeworkId },
      select: this.submissionSelect(),
      orderBy: [{ submittedAt: "desc" }],
    });
  }

  async grade(
    homeworkId: string,
    submissionId: string,
    input: GradeSubmissionInput,
    actor: RequestUser,
    request: Request,
  ) {
    const homework = await this.getHomeworkForTeacherCheck(homeworkId, actor);

    const previous = await this.prisma.homeworkSubmission.findUniqueOrThrow({
      where: { id: submissionId },
      select: this.submissionSelect(),
    });
    if (previous.homeworkId !== homeworkId) {
      throw new NotFoundException("Submission not found for this assignment.");
    }

    const maxValue = input.maxValue ?? 100;

    // La nota se escribe por el writer único, que dentro de una transacción exige la
    // variante `InTransaction`: `upsertMark()` escribe por `this.prisma` y ahí adentro
    // tomaría otra conexión del pool, sin `app.tenant_id`. Ver el skill `rls-multitenant`,
    // trampa #3. El `publish()` que devuelve se invoca DESPUÉS del commit.
    const { submission, publishMark } = await runInTenantTransaction(
      this.prisma,
      this.tenantRlsContext,
      homework.tenantId,
      async (tx) => {
        const updated = await tx.homeworkSubmission.update({
          where: { id: submissionId },
          data: {
            status: "GRADED",
            feedbackComment: input.feedbackComment,
            feedbackKey: input.feedbackKey,
            feedbackName: input.feedbackName,
            gradedAt: new Date(),
          },
          select: this.submissionSelect(),
        });

        const { publish } = await this.marks.upsertMarkInTransaction(
          {
            tenantId: homework.tenantId,
            studentId: previous.studentId,
            subjectId: homework.subjectId,
            teacherId: homework.teacherId,
            homeworkId,
            // El año de la TAREA, no el activo: una tarea de un año ya cerrado que se
            // califica tarde pertenece a su año, o la nota caería en el boletín del
            // año equivocado. Si la tarea no lo tiene, upsertMark cae al año activo.
            academicYearId: homework.academicYearId,
            title: homework.title,
            value: input.value,
            maxValue,
            comment: input.feedbackComment,
          },
          { userId: actor.id, role: actor.role, ipAddress: request.ip, userAgent: request.headers["user-agent"] },
          tx,
        );

        return { submission: updated, publishMark: publish };
      },
    );

    // Recién acá el alumno se entera: la nota ya está comiteada.
    publishMark();

    await this.audit.record({
      tenantId: homework.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "homework_submission.graded",
      entityType: "HomeworkSubmission",
      entityId: submissionId,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(submission),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return submission;
  }

  private async resolveStudent(actor: RequestUser) {
    const student = await this.prisma.student.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true, tenantId: true, groupId: true },
    });
    if (!student) {
      throw new ForbiddenException("This account has no student profile.");
    }
    return student;
  }

  private async assertAccessible(
    homeworkId: string,
    student: { tenantId: string; groupId: string | null },
  ) {
    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
      select: {
        id: true,
        tenantId: true,
        groupId: true,
        teacherId: true,
        subjectId: true,
        title: true,
        dueDate: true,
        availableFrom: true,
        cutOffDate: true,
      },
    });

    if (!homework || homework.tenantId !== student.tenantId || homework.groupId !== student.groupId) {
      throw new NotFoundException("Assignment not found.");
    }

    return homework;
  }

  private async getHomeworkForTeacherCheck(homeworkId: string, actor: RequestUser) {
    const homework = await this.prisma.homework.findUniqueOrThrow({
      where: { id: homeworkId },
      select: { id: true, tenantId: true, teacherId: true, subjectId: true, title: true, academicYearId: true },
    });

    if (!this.isGlobalAdmin(actor) && actor.tenantId !== homework.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (ownTeacherId !== homework.teacherId) {
        throw new ForbiddenException("You can only manage submissions for your own classes.");
      }
    }

    return homework;
  }

  private async resolveOwnTeacherId(actor: RequestUser) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    });
    return teacher?.id;
  }

  private isGlobalAdmin(actor: RequestUser) {
    return actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
  }

  private submissionSelect() {
    return {
      id: true,
      homeworkId: true,
      studentId: true,
      status: true,
      attachmentKey: true,
      attachmentName: true,
      submittedAt: true,
      feedbackComment: true,
      feedbackKey: true,
      feedbackName: true,
      gradedAt: true,
      student: {
        select: { id: true, firstName: true, lastName: true },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
