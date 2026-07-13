import { z } from "zod";

export const createSubjectSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(30).optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    code: z.string().min(1).max(30).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
