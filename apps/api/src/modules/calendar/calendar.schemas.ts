import { z } from "zod";

/**
 * Las seis fuentes de fechas que ya existían en el sistema y que nadie veía juntas
 * (docs/planning/calendario.md §1.5). El calendario no es una tabla de eventos: es una
 * proyección de todo lo que ya tiene fecha.
 */
export const CALENDAR_SOURCES = [
  "event",
  "homework",
  "period",
  "invoice",
  "election",
  "schedule",
] as const;

export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

/**
 * `schedule` queda fuera del default a propósito: son cinco clases por día, así que satura la
 * grilla mensual y tapa todo lo demás. Se pide explícitamente cuando la vista lo aguanta.
 */
export const DEFAULT_CALENDAR_SOURCES: CalendarSource[] = [
  "event",
  "homework",
  "period",
  "invoice",
  "election",
];

export const MAX_RANGE_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

export const listCalendarQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    // Opt-in por consulta: pedir seis fuentes cuando se necesita una son cinco consultas
    // regaladas en cada cambio de mes.
    sources: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      )
      .pipe(z.array(z.enum(CALENDAR_SOURCES)).nonempty().optional()),
  })
  .superRefine((query, ctx) => {
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

export type ListCalendarQuery = z.infer<typeof listCalendarQuerySchema>;

/**
 * Ítem normalizado del calendario agregado.
 *
 * `editable` es **false para todo lo derivado**, sin excepción: una entrega de tarea se edita
 * en el módulo de tareas y una factura en cartera. Duplicar la lógica de permisos de cinco
 * módulos dentro del calendario es exactamente lo que este diseño evita (§2.D del plan).
 */
export type CalendarItem = {
  /** `${source}:${sourceId}` — único en la respuesta y estable entre consultas. */
  id: string;
  source: CalendarSource;
  sourceId: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location?: string | null;
  editable: boolean;
  /** Deep link al módulo dueño: el clic lleva a donde el dato de verdad se edita. */
  href: string;
};
