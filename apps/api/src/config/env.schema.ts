import { z } from "zod";

const csvUrlsSchema = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
  .refine((urls) => urls.every((url) => z.string().url().safeParse(url).success), {
    message: "Must be a comma-separated list of valid URLs.",
  });

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_DOMAIN: z.string().min(1).default("classia.com.co"),
  APP_WEB_URL: z.string().url().default("http://localhost:3000"),
  APP_CORS_ORIGINS: csvUrlsSchema.optional(),
  APP_API_URL: z.string().url().default("http://localhost:3001"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(8),
  REFRESH_TOKEN_SECRET: z.string().min(8),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;
