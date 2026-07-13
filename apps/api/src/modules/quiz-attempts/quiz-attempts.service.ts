import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { SaveAnswerInput } from "./quiz-attempts.schemas";

@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async getQuiz(homeworkId: string, actor: RequestUser) {
    const student = await this.resolveStudent(actor);
    const homework = await this.assertAccessible(homeworkId, student);

    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId: student.id } },
      include: { answers: true },
    });

    const revealAnswers = attempt ? attempt.status !== "IN_PROGRESS" : false;

    return {
      homework: {
        id: homework.id,
        title: homework.title,
        description: homework.description,
        dueDate: homework.dueDate,
        type: homework.type,
        weight: homework.weight,
        allowNavigation: homework.allowNavigation,
      },
      questions: homework.questions.map((question) => ({
        id: question.id,
        type: question.type,
        text: question.text,
        points: question.points,
        order: question.order,
        imageKey: question.imageKey,
        imageName: question.imageName,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
          ...(revealAnswers ? { isCorrect: option.isCorrect, feedback: option.feedback } : {}),
        })),
      })),
      attempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            score: attempt.score,
            maxScore: attempt.maxScore,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            answers: attempt.answers.map((answer) => ({
              questionId: answer.questionId,
              selectedOptionId: answer.selectedOptionId,
              textAnswer: answer.textAnswer,
              ...(revealAnswers ? { isCorrect: answer.isCorrect, pointsAwarded: answer.pointsAwarded } : {}),
            })),
          }
        : null,
    };
  }

  async start(homeworkId: string, actor: RequestUser, request: Request) {
    const student = await this.resolveStudent(actor);
    const homework = await this.assertAccessible(homeworkId, student);

    const existing = await this.prisma.quizAttempt.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId: student.id } },
    });

    if (existing) {
      if (existing.status !== "IN_PROGRESS") {
        throw new ForbiddenException("This quiz has already been submitted.");
      }
      return existing;
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        tenantId: student.tenantId,
        homeworkId,
        studentId: student.id,
        status: "IN_PROGRESS",
      },
    });

    await this.audit.record({
      tenantId: student.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "quiz.started",
      entityType: "QuizAttempt",
      entityId: attempt.id,
      newValues: { homeworkId, studentId: student.id, homeworkTitle: homework.title },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return attempt;
  }

  async saveAnswer(homeworkId: string, attemptId: string, input: SaveAnswerInput, actor: RequestUser) {
    const student = await this.resolveStudent(actor);
    const attempt = await this.assertOwnAttempt(attemptId, homeworkId, student.id);

    if (attempt.status !== "IN_PROGRESS") {
      throw new ForbiddenException("This quiz has already been submitted.");
    }

    const question = await this.prisma.question.findFirst({
      where: { id: input.questionId, homeworkId },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException("Question not found for this quiz.");
    }

    return this.prisma.quizAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: input.questionId } },
      create: {
        attemptId,
        questionId: input.questionId,
        selectedOptionId: input.selectedOptionId,
        textAnswer: input.textAnswer,
      },
      update: {
        selectedOptionId: input.selectedOptionId ?? null,
        textAnswer: input.textAnswer ?? null,
      },
    });
  }

  async submit(homeworkId: string, attemptId: string, actor: RequestUser, request: Request) {
    const student = await this.resolveStudent(actor);
    const attempt = await this.assertOwnAttempt(attemptId, homeworkId, student.id);

    if (attempt.status !== "IN_PROGRESS") {
      throw new ForbiddenException("This quiz has already been submitted.");
    }

    const homework = await this.prisma.homework.findUniqueOrThrow({
      where: { id: homeworkId },
      select: {
        id: true,
        tenantId: true,
        teacherId: true,
        subjectId: true,
        title: true,
        questions: {
          select: {
            id: true,
            type: true,
            points: true,
            options: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });

    const answers = await this.prisma.quizAnswer.findMany({ where: { attemptId } });
    const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

    let totalScore = 0;
    let maxScore = 0;
    let hasUngraded = false;

    await this.prisma.$transaction(async (tx) => {
      for (const question of homework.questions) {
        maxScore += question.points;
        const answer = answersByQuestion.get(question.id);

        if (question.type === "SHORT_ANSWER") {
          hasUngraded = true;
          continue;
        }

        const correctOption = question.options.find((option) => option.isCorrect);
        const isCorrect = Boolean(answer?.selectedOptionId) && answer!.selectedOptionId === correctOption?.id;
        const pointsAwarded = isCorrect ? question.points : 0;
        totalScore += pointsAwarded;

        if (answer) {
          await tx.quizAnswer.update({
            where: { id: answer.id },
            data: { isCorrect, pointsAwarded },
          });
        } else {
          await tx.quizAnswer.create({
            data: { attemptId, questionId: question.id, isCorrect: false, pointsAwarded: 0 },
          });
        }
      }

      await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: hasUngraded ? "SUBMITTED" : "GRADED",
          score: totalScore,
          maxScore,
          submittedAt: new Date(),
        },
      });

      if (!hasUngraded && maxScore > 0) {
        const value = Math.round((totalScore / maxScore) * 100 * 100) / 100;
        const existingMark = await tx.mark.findFirst({
          where: { studentId: student.id, homeworkId },
          select: { id: true },
        });

        if (existingMark) {
          await tx.mark.update({
            where: { id: existingMark.id },
            data: { value, maxValue: 100 },
          });
        } else {
          await tx.mark.create({
            data: {
              tenantId: homework.tenantId,
              studentId: student.id,
              subjectId: homework.subjectId,
              teacherId: homework.teacherId,
              homeworkId,
              title: homework.title,
              value,
              maxValue: 100,
            },
          });
        }
      }
    });

    await this.audit.record({
      tenantId: student.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "quiz.submitted",
      entityType: "QuizAttempt",
      entityId: attemptId,
      newValues: { homeworkId, studentId: student.id, totalScore, maxScore, hasUngraded },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return this.prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { answers: true },
    });
  }

  private async assertOwnAttempt(attemptId: string, homeworkId: string, studentId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.homeworkId !== homeworkId || attempt.studentId !== studentId) {
      throw new NotFoundException("Quiz attempt not found.");
    }
    return attempt;
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

  private async assertAccessible(homeworkId: string, student: { tenantId: string; groupId: string | null }) {
    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
      select: {
        id: true,
        tenantId: true,
        groupId: true,
        title: true,
        description: true,
        dueDate: true,
        type: true,
        weight: true,
        allowNavigation: true,
        questions: {
          select: {
            id: true,
            type: true,
            text: true,
            points: true,
            imageKey: true,
            imageName: true,
            order: true,
            options: { select: { id: true, text: true, isCorrect: true, feedback: true, order: true } },
          },
          orderBy: [{ order: Prisma.SortOrder.asc }, { createdAt: Prisma.SortOrder.asc }],
        },
      },
    });

    if (!homework || homework.tenantId !== student.tenantId || homework.groupId !== student.groupId) {
      throw new NotFoundException("Quiz not found.");
    }

    if (homework.questions.length === 0) {
      throw new ForbiddenException("This assignment has no questions yet.");
    }

    return homework;
  }
}
