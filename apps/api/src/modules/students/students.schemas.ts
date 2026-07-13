import { z } from "zod";

export const createStudentSchema = z.object({
  tenantId: z.string().min(1).optional(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  documentId: z.string().min(1).max(80).optional(),
  birthDate: z.coerce.date().optional(),
  groupId: z.string().min(1).optional().nullable(),
  guardianIds: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z
  .object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    documentId: z.string().min(1).max(80).optional().nullable(),
    birthDate: z.coerce.date().optional().nullable(),
    groupId: z.string().min(1).optional().nullable(),
    guardianIds: z.array(z.string().min(1)).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
