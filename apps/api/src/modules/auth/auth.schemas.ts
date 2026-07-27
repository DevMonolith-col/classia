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

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  tenantSlug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  // Mismo mínimo que `loginSchema`: subir el listón acá y no en la creación de usuarios
  // dejaría cuentas que no pueden restablecer la contraseña que ya tienen.
  password: z.string().min(6).max(128),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6).max(128),
    // Mismo mínimo que `resetPasswordSchema`, por el mismo motivo: exigir más acá que en la
    // creación de usuarios dejaría cuentas que no pueden cambiar la contraseña que ya tienen.
    newPassword: z.string().min(6).max(128),
    // El JWT no lleva el id de la sesión, así que el cliente manda su refresh token para que
    // el servidor sepa cuál de las sesiones NO cerrar. Mismo idioma que `/auth/logout`, que
    // también identifica la sesión por el refresh token del cuerpo.
    refreshToken: z.string().min(32),
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "La contraseña nueva debe ser distinta de la actual.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

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
