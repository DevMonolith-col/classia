import { z } from "zod";

export const tenantSlugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/, {
    message: "El slug solo puede contener minusculas, numeros y guiones.",
  });

export const emailSchema = z.string().email();

export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: tenantSlugSchema,
  primaryDomain: z.string().min(3).max(255).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const loginSchema = z.object({
  email: emailSchema.transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
  tenantSlug: tenantSlugSchema.optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
