import { TenantStatus } from "@prisma/client";
import { z } from "zod";

export const tenantSlugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/);

export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: tenantSlugSchema,
  primaryDomain: z.string().min(3).max(255).optional(),
  status: z.nativeEnum(TenantStatus).optional(),
  logoUrl: z.string().url().optional(),
  brandColor: z.string().min(4).max(20).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = createTenantSchema
  .omit({ slug: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
