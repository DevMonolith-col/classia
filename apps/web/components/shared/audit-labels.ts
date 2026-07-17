export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "attendance.records.updated": "registró asistencia",
  "attendance.session.created": "abrió una sesión de asistencia",
  "attendance.session.updated": "actualizó una sesión de asistencia",
  "event.created": "creó un evento",
  "event.deleted": "eliminó un evento",
  "group.created": "creó un curso",
  "group.updated": "actualizó un curso",
  "guardian.created": "registró un acudiente",
  "guardian.updated": "actualizó un acudiente",
  "homework.created": "creó una asignación",
  "homework.updated": "actualizó una asignación",
  "homework_submission.graded": "calificó una entrega",
  "homework_submission.submitted": "entregó una tarea",
  "mark.bulk_created": "registró calificaciones",
  "mark.created": "registró una calificación",
  "mark.updated": "actualizó una calificación",
  "membership.created": "agregó un usuario al colegio",
  "membership.updated": "actualizó una membresía",
  "question.created": "creó una pregunta",
  "question.deleted": "eliminó una pregunta",
  "question.updated": "actualizó una pregunta",
  "quiz.started": "inició un quiz",
  "quiz.submitted": "entregó un quiz",
  "quiz_answer.graded": "calificó una respuesta",
  "schedule.created": "creó un horario",
  "schedule.updated": "actualizó un horario",
  "student.created": "registró un estudiante",
  "student.updated": "actualizó un estudiante",
  "subject.created": "creó una materia",
  "subject.updated": "actualizó una materia",
  "teacher.created": "registró un profesor",
  "teacher.updated": "actualizó un profesor",
  "tenant.created": "creó un colegio",
  "tenant.updated": "actualizó un colegio",
  "user.created": "creó un usuario",
  "user.updated": "actualizó un usuario",
  "auth.login": "inició sesión",
  "auth.logout": "cerró sesión",
  "auth.refresh": "renovó sesión",
  "auth.impersonate": "accedió como colegio",
  "auth.register": "se registró",
  "support.access.requested": "solicitó acceso de soporte",
}

/** Session/auth events are noise for an activity feed — they don't represent institutional work. */
export function isInstitutionalAction(action: string) {
  return !action.startsWith("auth.") && !action.startsWith("tenant.")
}

export function humanizeAuditAction(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/[._]/g, " ")
}
