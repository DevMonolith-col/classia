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
