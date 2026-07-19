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
