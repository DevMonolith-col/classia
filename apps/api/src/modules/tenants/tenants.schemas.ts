import { TenantStatus } from "@prisma/client";
import { z } from "zod";
import { MAX_ACCESS_DURATION_MINUTES } from "../access-control/access-control.schemas";

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
  // Techo propio del colegio para la duración de un acceso de soporte
  // concedido. null = "usa el techo absoluto del sistema" (ver
  // access-control.service#approve). Nunca puede guardarse por encima del
  // techo absoluto — el .max() de acá es la validación de backend, no solo
  // la del frontend.
  maxAccessDurationMinutes: z.number().int().min(15).max(MAX_ACCESS_DURATION_MINUTES).nullable().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = createTenantSchema
  .omit({ slug: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
