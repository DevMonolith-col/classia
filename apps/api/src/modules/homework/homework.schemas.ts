import { z } from "zod";

export const HOMEWORK_TYPES = ["TAREA", "EXAMEN", "QUIZ", "PROYECTO"] as const;

export const listHomeworkQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
});

export type ListHomeworkQuery = z.infer<typeof listHomeworkQuerySchema>;

export const createHomeworkSchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    groupId: z.string().min(1),
    subjectId: z.string().min(1),
    teacherId: z.string().min(1).optional(),
    title: z.string().min(1).max(150),
    description: z.string().max(2000).optional(),
    availableFrom: z.coerce.date().optional(),
    dueDate: z.coerce.date(),
    cutOffDate: z.coerce.date().optional(),
    weight: z.number().min(0).max(100).optional(),
    type: z.enum(HOMEWORK_TYPES).optional(),
    allowNavigation: z.boolean().optional(),
    attachmentKey: z.string().min(1).optional(),
    attachmentName: z.string().min(1).max(200).optional(),
  })
  .refine((data) => !data.availableFrom || data.availableFrom <= data.dueDate, {
    message: "availableFrom must be before or equal to dueDate.",
    path: ["availableFrom"],
  })
  .refine((data) => !data.cutOffDate || data.cutOffDate >= data.dueDate, {
    message: "cutOffDate must be after or equal to dueDate.",
    path: ["cutOffDate"],
  });

export type CreateHomeworkInput = z.infer<typeof createHomeworkSchema>;

export const updateHomeworkSchema = z
  .object({
    title: z.string().min(1).max(150).optional(),
    description: z.string().max(2000).optional().nullable(),
    availableFrom: z.coerce.date().optional().nullable(),
    dueDate: z.coerce.date().optional(),
    cutOffDate: z.coerce.date().optional().nullable(),
    weight: z.number().min(0).max(100).optional(),
    type: z.enum(HOMEWORK_TYPES).optional(),
    allowNavigation: z.boolean().optional(),
    attachmentKey: z.string().min(1).optional().nullable(),
    attachmentName: z.string().min(1).max(200).optional().nullable(),
    status: z.enum(["ACTIVE", "CLOSED", "ARCHIVED"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  })
  .refine((data) => !data.availableFrom || !data.dueDate || data.availableFrom <= data.dueDate, {
    message: "availableFrom must be before or equal to dueDate.",
    path: ["availableFrom"],
  })
  .refine((data) => !data.cutOffDate || !data.dueDate || data.cutOffDate >= data.dueDate, {
    message: "cutOffDate must be after or equal to dueDate.",
    path: ["cutOffDate"],
  });

export type UpdateHomeworkInput = z.infer<typeof updateHomeworkSchema>;
