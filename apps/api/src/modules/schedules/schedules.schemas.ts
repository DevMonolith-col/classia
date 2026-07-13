import { z } from "zod";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM 24h format");

export const listSchedulesQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
});

export type ListSchedulesQuery = z.infer<typeof listSchedulesQuerySchema>;

export const createScheduleSchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    groupId: z.string().min(1),
    subjectId: z.string().min(1),
    teacherId: z.string().min(1),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
    room: z.string().min(1).max(60).optional(),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "endTime must be after startTime.",
    path: ["endTime"],
  });

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = z
  .object({
    groupId: z.string().min(1).optional(),
    subjectId: z.string().min(1).optional(),
    teacherId: z.string().min(1).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    room: z.string().min(1).max(60).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  })
  .refine((value) => !(value.startTime && value.endTime) || value.startTime < value.endTime, {
    message: "endTime must be after startTime.",
    path: ["endTime"],
  });

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
