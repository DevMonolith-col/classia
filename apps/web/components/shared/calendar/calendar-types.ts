// Tipos y presentación del calendario, compartidos por los cuatro portales.
//
// El color NO se persiste: se deriva de `type`. Un color guardado en la base es un dato de
// presentación en la capa equivocada y garantiza que web, el futuro móvil y el feed ICS se
// contradigan (docs/planning/calendario.md §5).

export type CalendarEventType =
  | "ACADEMICO"
  | "INSTITUCIONAL"
  | "REUNION"
  | "ADMINISTRATIVO"
  | "FESTIVO"

export type UserRole =
  | "SUPER_ADMIN"
  | "TENANT_ADMIN"
  | "PRINCIPAL"
  | "COORDINATOR"
  | "SECRETARY"
  | "TEACHER"
  | "GUARDIAN"
  | "STUDENT"
  | "SUPPORT_AGENT"
  | "SUPPORT_SUPERVISOR"

/** Lo que devuelve `GET /events`. */
export type CalendarEvent = {
  id: string
  tenantId: string
  title: string
  description?: string | null
  type: CalendarEventType
  startsAt: string
  endsAt: string
  allDay: boolean
  location?: string | null
  targetRole?: UserRole | null
  groupId?: string | null
  isSchoolDayOff: boolean
  reminderMinutesBefore?: number | null
  createdById?: string | null
  createdAt: string
  updatedAt: string
}

export const EVENT_TYPES: CalendarEventType[] = [
  "ACADEMICO",
  "INSTITUCIONAL",
  "REUNION",
  "ADMINISTRATIVO",
  "FESTIVO",
]

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  ACADEMICO: "Académico",
  INSTITUCIONAL: "Institucional",
  REUNION: "Reunión",
  ADMINISTRATIVO: "Administrativo",
  FESTIVO: "Festivo",
}

/** Fondo sólido, para las píldoras dentro de la grilla. */
export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  ACADEMICO: "bg-orange-500",
  INSTITUCIONAL: "bg-pink-500",
  REUNION: "bg-purple-500",
  ADMINISTRATIVO: "bg-blue-500",
  FESTIVO: "bg-emerald-600",
}

export const TARGET_ROLE_LABELS: Partial<Record<UserRole, string>> = {
  TEACHER: "Profesores",
  GUARDIAN: "Acudientes",
  STUDENT: "Estudiantes",
  COORDINATOR: "Coordinación",
  PRINCIPAL: "Rectoría",
  SECRETARY: "Secretaría",
  TENANT_ADMIN: "Administración",
}

/**
 * Fecha civil `YYYY-MM-DD` de un instante, en hora local del navegador.
 *
 * Es la clave con la que se agrupan los eventos por casilla de la grilla. Se usa la hora
 * local y no UTC a propósito: el usuario está viendo su propio calendario, y el backend ya
 * normalizó los eventos de todo el día a los límites del día en la zona del colegio.
 */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Rango de días que cubre un evento, como claves `YYYY-MM-DD`. */
export function eventDateKeys(event: CalendarEvent): string[] {
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  const keys: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  // Tope de seguridad: la ventana del API son 400 días, así que un evento no puede pasar de
  // ahí. Evita un bucle infinito si llegara una fecha corrupta.
  for (let guard = 0; guard <= 400 && cursor.getTime() <= last.getTime(); guard++) {
    keys.push(localDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

/**
 * Agrupa los eventos por día. Un evento de varios días aparece en **todos** sus días, que es
 * lo que un usuario espera de una semana de desarrollo institucional.
 */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    for (const key of eventDateKeys(event)) {
      const list = byDay.get(key)
      if (list) list.push(event)
      else byDay.set(key, [event])
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }
  return byDay
}

/** "08:00" en hora local; vacío si es de todo el día. */
export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return ""
  return new Date(event.startsAt).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatEventRange(event: CalendarEvent): string {
  if (event.allDay) return "Todo el día"
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  const time = (d: Date) => d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
  return `${time(start)} - ${time(end)}`
}
