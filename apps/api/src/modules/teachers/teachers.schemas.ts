import { z } from "zod";

export const createTeacherSchema = z.object({
  tenantId: z.string().min(1).optional(),
  userId: z.string().min(1),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const updateTeacherSchema = z
  .object({
    userId: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
