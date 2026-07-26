import { CalendarEventType, UserRole } from "@prisma/client";
import { z } from "zod";

// Ventana máxima de una consulta por rango. Un colegio genera decenas de eventos por año,
// así que el límite no es por volumen de filas sino para que nadie pida "del 1900 al 2100"
// y barra el índice completo.
export const MAX_RANGE_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

// Hasta 30 días de antelación. null y ausente significan "sin recordatorio"; 0 significa
// "al momento del evento", que es distinto.
const MAX_REMINDER_MINUTES = 30 * 24 * 60;

/**
 * `GET /events` tiene dos modos y la diferencia la marca `to`:
 *
 * - **Rango** (`to` presente): la grilla de mes/semana. `from` es obligatorio, la ventana
 *   está acotada a MAX_RANGE_DAYS y `limit` es opcional y sin default — un calendario que
 *   recorta a 5 eventos el mes de agosto miente.
 * - **Próximos** (`to` ausente): el widget "Próximos Eventos" del dashboard, que ya existe
 *   y llama `/events?limit=4` (apps/web/app/admin/page.tsx). `from` cae a "ahora" y `limit`
 *   a 5, igual que antes de este cambio.
 *
 * Los dos modos existen porque son dos preguntas distintas ("qué pasa en agosto" vs "qué
 * sigue"), y hacer `from`/`to` obligatorios sin más habría devuelto 400 al dashboard.
 */
export const listEventsQuerySchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((query, ctx) => {
    if (!query.to) {
      if (query.limit && query.limit > 50) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["limit"],
          message: "Sin 'to', el límite máximo es 50. Para pedir más, usa un rango.",
        });
      }
      return;
    }

    if (!query.from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "'from' es obligatorio cuando se envía 'to'.",
      });
      return;
    }

    if (query.to.getTime() < query.from.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "'to' no puede ser anterior a 'from'.",
      });
      return;
    }

    if (query.to.getTime() - query.from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: `El rango no puede exceder ${MAX_RANGE_DAYS} días.`,
      });
    }
  });

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

const eventFields = {
  title: z.string().min(1).max(160),
  description: z.string().max(4000).nullish(),
  type: z.nativeEnum(CalendarEventType),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean(),
  location: z.string().min(1).max(160).nullish(),
  // Audiencia — null en cualquiera de los dos significa "sin restringir por ahí".
  targetRole: z.nativeEnum(UserRole).nullish(),
  groupId: z.string().min(1).nullish(),
  isSchoolDayOff: z.boolean(),
  reminderMinutesBefore: z.number().int().min(0).max(MAX_REMINDER_MINUTES).nullish(),
};

export const createEventSchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    ...eventFields,
    type: eventFields.type.default(CalendarEventType.INSTITUCIONAL),
    allDay: eventFields.allDay.default(false),
    isSchoolDayOff: eventFields.isSchoolDayOff.default(false),
  })
  .refine((input) => input.endsAt.getTime() >= input.startsAt.getTime(), {
    path: ["endsAt"],
    message: "'endsAt' no puede ser anterior a 'startsAt'.",
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

// PATCH parcial: la comparación startsAt/endsAt no puede vivir acá porque el cuerpo puede
// traer solo uno de los dos y el otro sale de la fila existente. La valida el servicio,
// después de fusionar (ver EventsService#update).
export const updateEventSchema = z
  .object(eventFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Hay que enviar al menos un campo para actualizar.",
  });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;
