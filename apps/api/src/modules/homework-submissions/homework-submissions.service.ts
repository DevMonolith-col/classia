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

  /**
   * El **roster** de la tarea: una fila por estudiante del curso, haya entregado o no.
   *
   * Antes devolvía solo las entregas existentes, y eso dejaba fuera precisamente a quien el
   * profesor necesita ver al cerrar el periodo — el que no entregó. "No entregó" se deriva de
   * `submission === null` en vez de fabricar filas fantasma con estado `PENDING`
   * (`asignaciones-calificacion-en-linea.md` §5: ese estado es inalcanzable, ningún camino crea
   * una entrega sin estado explícito).
   *
   * Incluye también a quien tiene entrega pero **ya no está en el grupo** (se cambió de curso a
   * mitad de año). Filtrar solo por grupo lo desaparecería de la lista junto con su trabajo, y
   * su nota seguiría contando para el boletín sin que nadie pueda verla acá.
   *
   * La nota vigente va por consulta aparte y no por un `include` porque `HomeworkSubmission`
   * **no tiene relación con `Mark`**: se ligan por `(studentId, homeworkId)`, que es el
   * `@@unique` de `Mark`. Agregar esa relación significaría cambiar la forma de `Mark`, que
   * tiene frontera estricta con notas/boletines (§2). Son tres consultas fijas, no una por
   * estudiante.
   */
  async listForHomework(homeworkId: string, actor: RequestUser) {
    const homework = await this.getHomeworkForTeacherCheck(homeworkId, actor);

    const [groupStudents, submissions, marks] = await Promise.all([
      this.prisma.student.findMany({
        where: { groupId: homework.groupId, tenantId: homework.tenantId },
        select: this.rosterStudentSelect(),
      }),
      this.prisma.homeworkSubmission.findMany({
        where: { homeworkId },
        select: this.rosterSubmissionSelect(),
      }),
      this.prisma.mark.findMany({
        where: { homeworkId },
        select: { id: true, studentId: true, value: true, maxValue: true },
      }),
    ]);

    const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));
    const markByStudent = new Map(marks.map((m) => [m.studentId, m]));

    const students = [...groupStudents];
    const known = new Set(students.map((s) => s.id));
    const strayIds = submissions.map((s) => s.studentId).filter((id) => !known.has(id));
    if (strayIds.length > 0) {
      students.push(
        ...(await this.prisma.student.findMany({
          where: { id: { in: strayIds } },
          select: this.rosterStudentSelect(),
        })),
      );
    }

    return students
      .sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "es"),
      )
      .map((student) => {
        const mark = markByStudent.get(student.id);
        return {
          student,
          inGroup: known.has(student.id),
          submission: submissionByStudent.get(student.id) ?? null,
          mark: mark ? { id: mark.id, value: mark.value, maxValue: mark.maxValue } : null,
        };
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

    return this.applyGrade(homework, previous.studentId, input, actor, request);
  }

  /**
   * Calificar por estudiante en vez de por entrega, para poder calificar **a quien no
   * entregó**. El endpoint por `submissionId` no puede: esa fila no existe si el alumno nunca
   * subió nada, y al cierre de periodo ese es justo el caso que el profesor necesita resolver.
   *
   * Crea la entrega con `submittedAt: null` y `status: "GRADED"`, que es como queda
   * representable "no entregó pero tiene un 0" sin inventar un estado nuevo.
   */
  async gradeByStudent(
    homeworkId: string,
    studentId: string,
    input: GradeSubmissionInput,
    actor: RequestUser,
    request: Request,
  ) {
    const homework = await this.getHomeworkForTeacherCheck(homeworkId, actor);
    await this.assertStudentBelongsToHomework(homework, studentId);

    return this.applyGrade(homework, studentId, input, actor, request);
  }

  private async applyGrade(
    homework: {
      id: string;
      tenantId: string;
      teacherId: string;
      subjectId: string;
      title: string;
      academicYearId: string | null;
    },
    studentId: string,
    input: GradeSubmissionInput,
    actor: RequestUser,
    request: Request,
  ) {
    const homeworkId = homework.id;
    const previous = await this.prisma.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId } },
      select: this.submissionSelect(),
    });

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
        const updated = await tx.homeworkSubmission.upsert({
          where: { homeworkId_studentId: { homeworkId, studentId } },
          create: {
            homeworkId,
            studentId,
            tenantId: homework.tenantId,
            status: "GRADED",
            // Explícito y no por omisión: `submittedAt === null && status === "GRADED"` ES la
            // representación de "no entregó pero tiene nota". Ver §5 del plan.
            submittedAt: null,
            feedbackComment: input.feedbackComment,
            feedbackKey: input.feedbackKey,
            feedbackName: input.feedbackName,
            gradedAt: new Date(),
          },
          update: {
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
            studentId,
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
      entityId: submission.id,
      // Sin `oldValues` cuando la entrega no existía: la bitácora distingue así "le cambiaron
      // la nota" de "lo calificaron sin haber entregado".
      oldValues: previous ? this.toAuditJson(previous) : undefined,
      newValues: this.toAuditJson(submission),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return submission;
  }

  /**
   * El estudiante tiene que ser del curso de la tarea — o tener ya una entrega, que es el caso
   * de quien se cambió de grupo a mitad de año y dejó su trabajo atrás. Sin la segunda mitad,
   * recalificarlo respondería 403 sobre una entrega que el roster sí muestra.
   */
  private async assertStudentBelongsToHomework(
    homework: { id: string; tenantId: string; groupId: string },
    studentId: string,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, tenantId: true, groupId: true },
    });
    if (!student || student.tenantId !== homework.tenantId) {
      throw new NotFoundException("Student not found.");
    }
    if (student.groupId === homework.groupId) return;

    const existing = await this.prisma.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId: homework.id, studentId } },
      select: { id: true },
    });
    if (!existing) {
      throw new ForbiddenException("This student is not in the assignment's group.");
    }
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
      select: {
        id: true,
        tenantId: true,
        teacherId: true,
        subjectId: true,
        groupId: true,
        title: true,
        academicYearId: true,
      },
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

  private rosterStudentSelect() {
    return { id: true, firstName: true, lastName: true, documentId: true };
  }

  /** Como `submissionSelect()` pero sin `student`: en el roster el estudiante va afuera. */
  private rosterSubmissionSelect() {
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
    };
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
