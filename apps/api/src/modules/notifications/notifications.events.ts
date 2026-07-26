/**
 * Contrato de eventos de dominio que disparan notificaciones.
 * Los productores (marks, homework, attendance, conversations, announcements)
 * solo importan estas constantes/tipos y emiten con EventEmitter2; no dependen
 * del módulo de notificaciones.
 */
export const NOTIFICATION_EVENTS = {
  MARK_PUBLISHED: "notification.mark.published",
  HOMEWORK_ASSIGNED: "notification.homework.assigned",
  ATTENDANCE_ABSENCE: "notification.attendance.absence",
  MESSAGE_RECEIVED: "notification.message.received",
  ANNOUNCEMENT_PUBLISHED: "notification.announcement.published",
  EVENT_PUBLISHED: "notification.event.published",
  EVENT_REMINDER: "notification.event.reminder",
} as const;

export type MarkPublishedEvent = {
  tenantId: string;
  markId: string;
  studentId: string;
  subjectName: string;
  markTitle: string;
  value: number;
  maxValue: number;
};

export type HomeworkAssignedEvent = {
  tenantId: string;
  homeworkId: string;
  groupId: string;
  title: string;
};

export type AttendanceAbsenceEvent = {
  tenantId: string;
  sessionId: string;
  studentId: string;
  date: Date;
};

export type MessageReceivedEvent = {
  tenantId: string;
  conversationId: string;
  messageId: string;
  fromUserId: string;
  recipientUserIds: string[];
  preview: string;
};

export type AnnouncementPublishedEvent = {
  tenantId: string;
  announcementId: string;
  authorId: string;
  title: string;
  targetRole: string | null;
  groupId: string | null;
};

/**
 * Un evento del calendario que le toca a alguien. Lo usan las dos notificaciones del módulo
 * —publicación y recordatorio— porque su audiencia se resuelve igual: `targetRole` + `groupId`,
 * el mismo par que ya usa Announcement.
 */
export type CalendarEventNotification = {
  tenantId: string;
  eventId: string;
  title: string;
  startsAt: Date;
  allDay: boolean;
  location: string | null;
  targetRole: string | null;
  groupId: string | null;
  /** Se excluye de los destinatarios: quien lo creó ya sabe. Null para el recordatorio. */
  authorId: string | null;
};
