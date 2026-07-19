import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationEventType, UserRole } from "@prisma/client";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  AnnouncementPublishedEvent,
  AttendanceAbsenceEvent,
  HomeworkAssignedEvent,
  MarkPublishedEvent,
  MessageReceivedEvent,
  NOTIFICATION_EVENTS,
} from "./notifications.events";
import { NotificationsService } from "./notifications.service";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

@Injectable()
export class NotificationsListeners {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(NOTIFICATION_EVENTS.MARK_PUBLISHED)
  async onMarkPublished(event: MarkPublishedEvent) {
    const recipients = await this.studentAndGuardianUserIds(event.studentId);
    await this.notifications.notify({
      tenantId: event.tenantId,
      eventType: NotificationEventType.MARK_PUBLISHED,
      recipientUserIds: recipients,
      title: "Nueva calificación",
      body: `${event.subjectName}: ${event.value}/${event.maxValue} — ${event.markTitle}`,
      entityType: "Mark",
      entityId: event.markId,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.HOMEWORK_ASSIGNED)
  async onHomeworkAssigned(event: HomeworkAssignedEvent) {
    const recipients = await this.groupStudentAndGuardianUserIds(event.groupId);
    await this.notifications.notify({
      tenantId: event.tenantId,
      eventType: NotificationEventType.HOMEWORK_ASSIGNED,
      recipientUserIds: recipients,
      title: "Nueva tarea",
      body: event.title,
      entityType: "Homework",
      entityId: event.homeworkId,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ATTENDANCE_ABSENCE)
  async onAbsence(event: AttendanceAbsenceEvent) {
    const recipients = await this.guardianUserIdsOfStudent(event.studentId);
    await this.notifications.notify({
      tenantId: event.tenantId,
      eventType: NotificationEventType.ATTENDANCE_ABSENCE_RECORDED,
      recipientUserIds: recipients,
      title: "Inasistencia registrada",
      body: `Se registró una inasistencia el ${formatDate(event.date)}.`,
      entityType: "AttendanceSession",
      entityId: event.sessionId,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.MESSAGE_RECEIVED)
  async onMessage(event: MessageReceivedEvent) {
    await this.notifications.notify({
      tenantId: event.tenantId,
      eventType: NotificationEventType.MESSAGE_RECEIVED,
      recipientUserIds: event.recipientUserIds,
      title: "Nuevo mensaje",
      body: event.preview,
      entityType: "Conversation",
      entityId: event.conversationId,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED)
  async onAnnouncement(event: AnnouncementPublishedEvent) {
    const recipients = await this.announcementRecipientUserIds(event);
    await this.notifications.notify({
      tenantId: event.tenantId,
      eventType: NotificationEventType.ANNOUNCEMENT_PUBLISHED,
      recipientUserIds: recipients,
      title: "Nuevo comunicado",
      body: event.title,
      entityType: "Announcement",
      entityId: event.announcementId,
    });
  }

  // ─── Resolución de destinatarios ──────────────────────────────────────────────

  private async studentAndGuardianUserIds(studentId: string): Promise<string[]> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        userId: true,
        guardians: { select: { guardian: { select: { userId: true } } } },
      },
    });
    if (!student) return [];
    const ids = student.guardians.map((link) => link.guardian.userId);
    if (student.userId) ids.push(student.userId);
    return ids;
  }

  private async guardianUserIdsOfStudent(studentId: string): Promise<string[]> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { guardians: { select: { guardian: { select: { userId: true } } } } },
    });
    return student?.guardians.map((link) => link.guardian.userId) ?? [];
  }

  private async groupStudentAndGuardianUserIds(groupId: string): Promise<string[]> {
    const students = await this.prisma.student.findMany({
      where: { groupId, isActive: true },
      select: {
        userId: true,
        guardians: { select: { guardian: { select: { userId: true } } } },
      },
    });
    const ids: string[] = [];
    for (const student of students) {
      if (student.userId) ids.push(student.userId);
      ids.push(...student.guardians.map((link) => link.guardian.userId));
    }
    return ids;
  }

  private async announcementRecipientUserIds(
    event: AnnouncementPublishedEvent,
  ): Promise<string[]> {
    // Solo se notifica a familias/estudiantes; el staff usa la cartelera.
    const wantGuardian = event.targetRole === null || event.targetRole === UserRole.GUARDIAN;
    const wantStudent = event.targetRole === null || event.targetRole === UserRole.STUDENT;
    if (!wantGuardian && !wantStudent) return [];

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: event.tenantId,
        isActive: true, // no notificar a familias de alumnos retirados
        ...(event.groupId ? { groupId: event.groupId } : {}),
      },
      select: {
        userId: true,
        guardians: { select: { guardian: { select: { userId: true } } } },
      },
    });

    const ids: string[] = [];
    for (const student of students) {
      if (wantStudent && student.userId) ids.push(student.userId);
      if (wantGuardian) ids.push(...student.guardians.map((link) => link.guardian.userId));
    }
    return ids.filter((id) => id !== event.authorId);
  }
}
