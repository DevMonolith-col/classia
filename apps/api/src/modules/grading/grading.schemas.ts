import { z } from "zod";

const bandInput = z.object({
  label: z.string().min(1).max(40),
  minValue: z.number(),
  maxValue: z.number(),
  order: z.number().int().min(0),
});

export const createScaleSchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    name: z.string().min(1).max(80),
    minValue: z.number(),
    maxValue: z.number(),
    passingValue: z.number(),
    isDefault: z.boolean().optional(),
    bands: z.array(bandInput).max(20).optional(),
  })
  .refine((s) => s.minValue < s.maxValue, { message: "minValue debe ser menor que maxValue.", path: ["maxValue"] })
  .refine((s) => s.passingValue >= s.minValue && s.passingValue <= s.maxValue, {
    message: "passingValue debe estar dentro del rango.",
    path: ["passingValue"],
  });
export type CreateScaleInput = z.infer<typeof createScaleSchema>;

export const updateScaleSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    passingValue: z.number().optional(),
    bands: z.array(bandInput).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });
export type UpdateScaleInput = z.infer<typeof updateScaleSchema>;

// Reemplaza todas las categorías de una clase (grupo+materia) en un periodo.
// Los pesos deben sumar 100% — es la fórmula del periodo.
export const setCategoriesSchema = z.object({
  groupId: z.string().min(1),
  subjectId: z.string().min(1),
  periodId: z.string().min(1),
  teacherId: z.string().min(1).optional(),
  categories: z
    .array(z.object({ name: z.string().min(1).max(60), weight: z.number().min(0).max(100) }))
    .min(1)
    .max(20)
    .refine((c) => Math.abs(c.reduce((s, x) => s + x.weight, 0) - 100) < 0.01, {
      message: "Los pesos de las categorías deben sumar 100%.",
    }),
});
export type SetCategoriesInput = z.infer<typeof setCategoriesSchema>;

export const listCategoriesQuerySchema = z.object({
  groupId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  periodId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
});
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
