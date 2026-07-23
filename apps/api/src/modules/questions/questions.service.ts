import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { RequestUser } from "../../common/types/request-context";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateQuestionInput, UpdateQuestionInput } from "./questions.schemas";

@Injectable()
export class QuestionsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async list(homeworkId: string, actor: RequestUser) {
    await this.assertCanAuthor(homeworkId, actor);

    return this.prisma.question.findMany({
      where: { homeworkId },
      select: this.questionSelect(),
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(homeworkId: string, input: CreateQuestionInput, actor: RequestUser, request: Request) {
    const homework = await this.assertCanAuthor(homeworkId, actor);

    const count = await this.prisma.question.count({ where: { homeworkId } });

    const question = await this.prisma.question.create({
      data: {
        homeworkId,
        tenantId: homework.tenantId,
        type: input.type,
        text: input.text,
        points: input.points ?? 1,
        imageKey: input.imageKey,
        imageName: input.imageName,
        order: count,
        options: input.options
          ? {
              create: input.options.map((option, index) => ({
                tenantId: homework.tenantId,
                text: option.text,
                isCorrect: option.isCorrect,
                feedback: option.feedback,
                order: index,
              })),
            }
          : undefined,
      },
      select: this.questionSelect(),
    });

    await this.audit.record({
      tenantId: homework.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "question.created",
      entityType: "Question",
      entityId: question.id,
      newValues: this.toAuditJson(question),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return question;
  }

  async update(questionId: string, input: UpdateQuestionInput, actor: RequestUser, request: Request) {
    const previous = await this.findQuestionOrThrow(questionId);
    const homework = await this.assertCanAuthor(previous.homeworkId, actor);

    const question = await this.prisma.$transaction(async (tx) => {
      if (input.options) {
        await tx.questionOption.deleteMany({ where: { questionId } });
        await tx.questionOption.createMany({
          data: input.options.map((option, index) => ({
            questionId,
            tenantId: homework.tenantId,
            text: option.text,
            isCorrect: option.isCorrect,
            feedback: option.feedback,
            order: index,
          })),
        });
      }

      return tx.question.update({
        where: { id: questionId },
        data: {
          text: input.text,
          points: input.points,
          imageKey: input.imageKey === null ? null : input.imageKey,
          imageName: input.imageName === null ? null : input.imageName,
        },
        select: this.questionSelect(),
      });
    });

    await this.audit.record({
      tenantId: homework.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "question.updated",
      entityType: "Question",
      entityId: question.id,
      oldValues: this.toAuditJson(previous),
      newValues: this.toAuditJson(question),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return question;
  }

  async delete(questionId: string, actor: RequestUser, request: Request) {
    const previous = await this.findQuestionOrThrow(questionId);
    const homework = await this.assertCanAuthor(previous.homeworkId, actor);

    await this.prisma.question.delete({ where: { id: questionId } });

    await this.audit.record({
      tenantId: homework.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "question.deleted",
      entityType: "Question",
      entityId: questionId,
      oldValues: this.toAuditJson(previous),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { id: questionId };
  }

  private async findQuestionOrThrow(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: this.questionSelect(),
    });
    if (!question) {
      throw new NotFoundException("Question not found.");
    }
    return question;
  }

  private async assertCanAuthor(homeworkId: string, actor: RequestUser) {
    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
      select: { id: true, tenantId: true, teacherId: true },
    });

    if (!homework) {
      throw new NotFoundException("Homework not found.");
    }

    if (!this.isGlobalAdmin(actor) && actor.tenantId !== homework.tenantId) {
      throw new ForbiddenException("Tenant is outside of current context.");
    }

    if (actor.role === UserRole.TEACHER) {
      const ownTeacherId = await this.resolveOwnTeacherId(actor);
      if (ownTeacherId !== homework.teacherId) {
        throw new ForbiddenException("You can only manage questions for your own classes.");
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

  private questionSelect() {
    return {
      id: true,
      homeworkId: true,
      type: true,
      text: true,
      points: true,
      imageKey: true,
      imageName: true,
      order: true,
      createdAt: true,
      options: {
        select: { id: true, text: true, isCorrect: true, feedback: true, order: true },
        orderBy: { order: Prisma.SortOrder.asc },
      },
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
