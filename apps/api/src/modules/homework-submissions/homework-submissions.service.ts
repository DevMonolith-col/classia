import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { GradeSubmissionInput, SubmitHomeworkInput } from "./homework-submissions.schemas";

@Injectable()
export class HomeworkSubmissionsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
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

    const submission = await this.prisma.$transaction(async (tx) => {
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

      const existingMark = await tx.mark.findFirst({
        where: { studentId: previous.studentId, homeworkId },
        select: { id: true },
      });

      if (existingMark) {
        await tx.mark.update({
          where: { id: existingMark.id },
          data: { value: input.value, maxValue, comment: input.feedbackComment },
        });
      } else {
        await tx.mark.create({
          data: {
            tenantId: homework.tenantId,
            studentId: previous.studentId,
            subjectId: homework.subjectId,
            teacherId: homework.teacherId,
            homeworkId,
            title: homework.title,
            value: input.value,
            maxValue,
            comment: input.feedbackComment,
          },
        });
      }

      return updated;
    });

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
      select: { id: true, tenantId: true, teacherId: true, subjectId: true, title: true },
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
