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
  // Rol classia_app (sin superuser) -- la conexion real de runtime, para
  // que Row-Level Security aplique (ver docs/planning/aislamiento-rls-multitenant.md,
  // trampa #0/#7: DATABASE_URL usa "classia", que es superuser y siempre
  // ignora RLS). Default a DATABASE_URL solo para no romper entornos viejos
  // sin esta variable todavia -- en cualquier entorno con RLS activo debe
  // apuntar de verdad a classia_app.
  DATABASE_URL_APP: z.string().url().optional(),
  // Rol classia_platform_admin (BYPASSRLS) -- exclusivamente para el
  // puñado de lecturas genuinamente cross-tenant de SUPER_ADMIN/soporte y
  // el job "sweep" de expiración de accesos. Opcional: si no está seteada,
  // PlatformAdminPrismaService lanza al usarse en vez de fallar silenciosamente.
  DATABASE_URL_PLATFORM_ADMIN: z.string().url().optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(8),
  REFRESH_TOKEN_SECRET: z.string().min(8),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  EMAIL_PROVIDER: z.enum(["disabled", "resend"]).default("disabled"),
  EMAIL_FROM: z.string().min(1).default("notificaciones@classia.com.co"),
  RESEND_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
