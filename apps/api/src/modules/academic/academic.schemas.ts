import { z } from "zod";

export const createAcademicYearSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().min(1).max(40),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

export const updateAcademicYearSchema = z
  .object({
    name: z.string().min(1).max(40).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;

const periodInput = z.object({
  name: z.string().min(1).max(60),
  sequence: z.number().int().min(1).max(12),
  weight: z.number().min(0).max(100),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Reemplaza el set completo de periodos del año en una sola operación: así se
// puede validar que los pesos sumen 100% de forma atómica.
export const setPeriodsSchema = z.object({
  periods: z
    .array(periodInput)
    .min(1)
    .max(12)
    .refine(
      (periods) => Math.abs(periods.reduce((sum, p) => sum + p.weight, 0) - 100) < 0.01,
      { message: "Los pesos de los periodos deben sumar 100%." },
    )
    .refine(
      (periods) => new Set(periods.map((p) => p.sequence)).size === periods.length,
      { message: "Las secuencias de periodo no pueden repetirse." },
    ),
});
export type SetPeriodsInput = z.infer<typeof setPeriodsSchema>;
