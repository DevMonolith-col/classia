import { z } from "zod";

export const fileKeyQuerySchema = z.object({
  key: z.string().min(1),
});

export type FileKeyQuery = z.infer<typeof fileKeyQuerySchema>;
