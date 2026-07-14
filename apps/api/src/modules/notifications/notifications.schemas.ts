import { NotificationChannel, NotificationEventType } from "@prisma/client";
import { z } from "zod";

export const updatePreferenceSchema = z.object({
  eventType: z.nativeEnum(NotificationEventType),
  channel: z.nativeEnum(NotificationChannel),
  enabled: z.boolean(),
});

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
