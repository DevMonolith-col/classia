import { z } from "zod";

export const createEventSchema = z.object({
  tenantId: z.string().min(1).optional(),
  title: z.string().min(1).max(160),
  date: z.coerce.date(),
  location: z.string().min(1).max(160).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const listEventsQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
