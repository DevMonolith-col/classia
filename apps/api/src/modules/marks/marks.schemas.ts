import { z } from "zod";

export const listMarksQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  homeworkId: z.string().min(1).optional(),
  period: z.coerce.number().int().min(1).max(12).optional(),
});

export type ListMarksQuery = z.infer<typeof listMarksQuerySchema>;

export const createMarkSchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    studentId: z.string().min(1),
    subjectId: z.string().min(1),
    teacherId: z.string().min(1).optional(),
    homeworkId: z.string().min(1).optional(),
    title: z.string().min(1).max(120),
    value: z.number().min(0),
    maxValue: z.number().min(1).max(1000).optional(),
    comment: z.string().max(2000).optional(),
    period: z.number().int().min(1).max(12).optional(),
    date: z.coerce.date().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => data.value <= (data.maxValue ?? 100), {
    message: "value cannot exceed maxValue.",
    path: ["value"],
  });

export type CreateMarkInput = z.infer<typeof createMarkSchema>;

export const updateMarkSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    value: z.number().min(0).optional(),
    maxValue: z.number().min(1).max(1000).optional(),
    comment: z.string().max(2000).optional().nullable(),
    period: z.number().int().min(1).max(12).optional(),
    date: z.coerce.date().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  })
  .refine((data) => data.value === undefined || data.maxValue === undefined || data.value <= data.maxValue, {
    message: "value cannot exceed maxValue.",
    path: ["value"],
  });

export type UpdateMarkInput = z.infer<typeof updateMarkSchema>;

export const bulkCreateMarksSchema = z.object({
  tenantId: z.string().min(1).optional(),
  groupId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1).optional(),
  homeworkId: z.string().min(1).optional(),
  title: z.string().min(1).max(120),
  maxValue: z.number().min(1).max(1000).optional(),
  period: z.number().int().min(1).max(12).optional(),
  date: z.coerce.date().optional(),
  isPublished: z.boolean().optional(),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        value: z.number().min(0),
      }),
    )
    .min(1),
});

export type BulkCreateMarksInput = z.infer<typeof bulkCreateMarksSchema>;
