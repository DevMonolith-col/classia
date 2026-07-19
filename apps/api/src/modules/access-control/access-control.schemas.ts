import { z } from "zod"

// Techo del sistema para cualquier duración de acceso (solicitada o ajustada al
// aprobar). No existe un modelo de configuración por-tenant para esto hoy —
// tocar el modelo de settings del tenant para una sola constante habría sido
// una ampliación de alcance no pedida, así que se mantiene como techo de
// aplicación, igual que ya regía implícitamente vía el .max() del schema de
// solicitud.
export const MAX_ACCESS_DURATION_MINUTES = 480

export const requestAccessSchema = z.object({
  ticketId: z.string().min(1),
  scope: z.enum(["OPERATIVO", "DATOS_PERSONALES"]),
  reason: z.string().min(10, "Describe para qué necesitas el acceso (mínimo 10 caracteres)"),
  durationMinutes: z.number().int().min(15).max(MAX_ACCESS_DURATION_MINUTES).default(240),
})
export type RequestAccessInput = z.infer<typeof requestAccessSchema>

// El aprobador puede fijar una duración distinta a la solicitada; si la omite,
// se respeta la solicitada (approve() en el service la resuelve así). Nunca
// puede exceder MAX_ACCESS_DURATION_MINUTES, sin importar qué se pidió.
export const approveAccessSchema = z.object({
  durationMinutes: z.number().int().min(15).max(MAX_ACCESS_DURATION_MINUTES).optional(),
})
export type ApproveAccessInput = z.infer<typeof approveAccessSchema>

export const denyAccessSchema = z.object({
  reason: z.string().min(5, "Indica por qué se niega el acceso"),
})
export type DenyAccessInput = z.infer<typeof denyAccessSchema>

export const revokeAccessSchema = z.object({
  reason: z.string().min(5).default("Revocado manualmente"),
})
export type RevokeAccessInput = z.infer<typeof revokeAccessSchema>

export const breakGlassSchema = z.object({
  ticketId: z.string().min(1),
  scope: z.enum(["OPERATIVO", "DATOS_PERSONALES"]),
  reason: z.string().min(15, "El acceso de emergencia exige una justificación detallada (mínimo 15 caracteres)"),
  durationMinutes: z.number().int().min(15).max(120).default(60),
})
export type BreakGlassInput = z.infer<typeof breakGlassSchema>
