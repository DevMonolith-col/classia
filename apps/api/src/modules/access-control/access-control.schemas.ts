import { z } from "zod"

export const requestAccessSchema = z.object({
  ticketId: z.string().min(1),
  scope: z.enum(["OPERATIVO", "DATOS_PERSONALES"]),
  reason: z.string().min(10, "Describe para qué necesitas el acceso (mínimo 10 caracteres)"),
  durationMinutes: z.number().int().min(15).max(480).default(240),
})
export type RequestAccessInput = z.infer<typeof requestAccessSchema>

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
