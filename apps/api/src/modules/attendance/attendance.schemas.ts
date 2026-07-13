import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";

export const createSessionSchema = z.object({
  scheduleId: z.string().min(1),
  date: z.coerce.date(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const listSessionsQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  scheduleId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

export const updateSessionSchema = z.object({
  isOpen: z.boolean(),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const submitRecordsSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.nativeEnum(AttendanceStatus),
        observation: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

export type SubmitRecordsInput = z.infer<typeof submitRecordsSchema>;
