import { z } from "zod";

export const createGuardianSchema = z.object({
  tenantId: z.string().min(1).optional(),
  userId: z.string().min(1),
});

export type CreateGuardianInput = z.infer<typeof createGuardianSchema>;

export const updateGuardianSchema = z
  .object({
    userId: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateGuardianInput = z.infer<typeof updateGuardianSchema>;
