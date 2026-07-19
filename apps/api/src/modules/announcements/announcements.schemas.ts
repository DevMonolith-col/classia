import { UserRole } from "@prisma/client";
import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(5000),
  targetRole: z.nativeEnum(UserRole).optional(),
  groupId: z.string().min(1).optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
