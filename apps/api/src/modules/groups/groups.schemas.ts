import { z } from "zod";

export const listGroupsQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
});

export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;

export const createGroupSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  grade: z.string().min(1).max(80),
  section: z.string().min(1).max(20),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    grade: z.string().min(1).max(80).optional(),
    section: z.string().min(1).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
