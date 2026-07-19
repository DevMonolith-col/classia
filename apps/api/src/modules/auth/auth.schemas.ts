import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(6).max(128),
  tenantSlug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const impersonateSchema = z.object({
  tenantId: z.string().uuid(),
  // Obligatorio: toda impersonación queda aislada al ticket que la justificó
  // (ver auth.service#impersonate). Sin esto, DataScopeGuard no podría resolver
  // el alcance por (agente, ticket, colegio) y caería a un alcance más amplio.
  ticketId: z.string().uuid(),
});

export type ImpersonateInput = z.infer<typeof impersonateSchema>;
