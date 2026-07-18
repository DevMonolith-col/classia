import { z } from "zod";

export const updateSettingsSchema = z.object({
  baseDomain: z.string().optional(),
  appName: z.string().optional(),
  force2FA: z.boolean().optional(),
  strictIpLock: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
  planBaseMaxStudents: z.number().int().optional(),
  planBaseMaxUsers: z.number().int().optional(),
  planBaseMaxStorageGb: z.number().int().optional(),
  planProMaxStudents: z.number().int().optional(),
  planProMaxUsers: z.number().int().optional(),
  planProMaxStorageGb: z.number().int().optional(),
  backupFreq: z.string().optional(),
  backupRetention: z.string().optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
