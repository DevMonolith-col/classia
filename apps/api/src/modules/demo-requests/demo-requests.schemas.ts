import { DemoRequestStatus } from "@prisma/client";
import { z } from "zod";

// Lo que el colegio dice que necesita. Lista cerrada a propósito: el formulario es público,
// así que estos valores terminan en la base sin que nadie los revise, y un texto libre por
// ítem sería un vector de spam. Lo que no entre acá va en `message`.
export const DEMO_REQUEST_INTERESTS = [
  "CALIFICACIONES",
  "ASISTENCIA",
  "COMUNICACION",
  "CARTERA",
  "BOLETINES",
  "HORARIOS",
  "CERTIFICADOS",
  "OTRO",
] as const;

// Techo de estudiantes: el colegio más grande de Colombia no llega a 10.000, y el campo
// alimenta la cotización — un número absurdo la vuelve basura, no la mejora.
const MAX_STUDENT_COUNT = 20_000;

/**
 * Cuerpo del formulario público. Todo lo que no sea imprescindible para contestar es
 * opcional: cada campo obligatorio de más es un colegio que abandona el formulario.
 *
 * Lo obligatorio es lo mínimo para poder responder: cómo se llama el colegio, quién escribe
 * y a dónde contestarle.
 */
export const createDemoRequestSchema = z.object({
  schoolName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().toLowerCase().email().max(160),
  contactPhone: z.string().trim().max(40).optional(),
  contactRole: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  studentCount: z.coerce.number().int().min(1).max(MAX_STUDENT_COUNT).optional(),
  interests: z.array(z.enum(DEMO_REQUEST_INTERESTS)).max(DEMO_REQUEST_INTERESTS.length).optional(),
  message: z.string().trim().max(2000).optional(),
  // De qué parte del sitio salió (hero, precios, login). Sirve para saber qué convierte;
  // acotado a un puñado de caracteres para que no se use como campo libre de spam.
  source: z.string().trim().max(40).optional(),
});

export type CreateDemoRequestInput = z.infer<typeof createDemoRequestSchema>;

export const listDemoRequestsQuerySchema = z.object({
  status: z.nativeEnum(DemoRequestStatus).optional(),
});

export type ListDemoRequestsQuery = z.infer<typeof listDemoRequestsQuerySchema>;

/**
 * Lo que el equipo comercial edita desde la bandeja interna. Nada de esto lo puede tocar
 * quien mandó el formulario: son campos de seguimiento, no del colegio.
 *
 * `quotedAmount` viaja como número y se guarda como Decimal(12,2). No hay ningún cobro
 * detrás — es el monto que se le ofreció, anotado para no tener que buscarlo en el correo.
 */
export const updateDemoRequestSchema = z
  .object({
    status: z.nativeEnum(DemoRequestStatus),
    quotedPlan: z.string().trim().max(80).nullish(),
    quotedAmount: z.coerce.number().min(0).max(9_999_999_999).nullish(),
    quotedCurrency: z.string().trim().length(3).toUpperCase().nullish(),
    internalNotes: z.string().trim().max(4000).nullish(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Hay que enviar al menos un campo para actualizar.",
  });

export type UpdateDemoRequestInput = z.infer<typeof updateDemoRequestSchema>;
