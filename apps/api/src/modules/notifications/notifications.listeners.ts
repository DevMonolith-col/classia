import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationEventType, UserRole } from "@prisma/client";
import { PrismaService } from "../../core/prisma/prisma.service";
import {
  AnnouncementPublishedEvent,
  AttendanceAbsenceEvent,
  CalendarEventNotification,
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

  @OnEvent(NOTIFICATION_EVENTS.EVENT_PUBLISHED)
  async onEventPublished(event: CalendarEventNotification) {
    await this.notifications.notify({
      tenantId: event.tenantId,
      eventType: NotificationEventType.EVENT_PUBLISHED,
      recipientUserIds: await this.calendarEventRecipientUserIds(event),
      title: "Nuevo evento en el calendario",
      body: `${event.title} — ${formatDate(event.startsAt)}`,
      entityType: "Event",
      entityId: event.eventId,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.EVENT_REMINDER)
  async onEventReminder(event: CalendarEventNotification) {
    const cuando = event.allDay
      ? formatDate(event.startsAt)
      : `${formatDate(event.startsAt)} a las ${new Date(event.startsAt).toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

    await this.notifications.notify({
      tenantId: event.tenantId,
      eventType: NotificationEventType.EVENT_REMINDER,
      recipientUserIds: await this.calendarEventRecipientUserIds(event),
      title: "Recordatorio",
      body: `${event.title} — ${cuando}${event.location ? ` · ${event.location}` : ""}`,
      entityType: "Event",
      entityId: event.eventId,
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

  /**
   * Destinatarios de un evento del calendario, según el mismo par `targetRole` + `groupId` que
   * filtra `EventsService`.
   *
   * A diferencia de los comunicados, acá **sí se notifica a profesores**: un evento dirigido a
   * `TEACHER` (un consejo académico) no tiene otro canal, mientras que la cartelera de
   * comunicados sí existe para el staff.
   *
   * Con `groupId` los profesores se acotan a los que dan clase en ese grupo, vía `Schedule` —
   * la misma relación que usa AudienceScopeService para el camino inverso.
   */
  private async calendarEventRecipientUserIds(
    event: CalendarEventNotification,
  ): Promise<string[]> {
    const wantGuardian = event.targetRole === null || event.targetRole === UserRole.GUARDIAN;
    const wantStudent = event.targetRole === null || event.targetRole === UserRole.STUDENT;
    const wantTeacher = event.targetRole === null || event.targetRole === UserRole.TEACHER;

    const ids: string[] = [];

    if (wantGuardian || wantStudent) {
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

      for (const student of students) {
        if (wantStudent && student.userId) ids.push(student.userId);
        if (wantGuardian) ids.push(...student.guardians.map((link) => link.guardian.userId));
      }
    }

    if (wantTeacher) {
      const teachers = await this.prisma.teacher.findMany({
        where: {
          tenantId: event.tenantId,
          ...(event.groupId ? { schedules: { some: { groupId: event.groupId } } } : {}),
        },
        select: { userId: true },
      });
      ids.push(...teachers.map((teacher) => teacher.userId));
    }

    // Quien lo creó ya lo sabe. En el recordatorio `authorId` viene null a propósito: para
    // entonces sí quiere que se lo recuerden.
    return event.authorId ? ids.filter((id) => id !== event.authorId) : ids;
  }
}
