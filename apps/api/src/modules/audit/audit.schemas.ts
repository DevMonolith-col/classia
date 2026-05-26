import { z } from "zod";

const optionalDateSchema = z
  .string()
  .datetime()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));

export const listAuditLogsSchema = z.object({
  tenantId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  action: z.string().min(1).max(120).optional(),
  entityType: z.string().min(1).max(120).optional(),
  entityId: z.string().min(1).max(120).optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
