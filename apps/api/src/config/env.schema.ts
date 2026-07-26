import { z } from "zod";

const MISSING_APP_URL_MESSAGE =
  "DATABASE_URL_APP es obligatoria: es el rol classia_app (sin superuser) con el que corre la app. " +
  "Sin ella, el aislamiento multi-tenant por Row-Level Security queda desactivado en silencio " +
  "(el rol de DATABASE_URL es superuser e ignora RLS). Ver .env.example.";

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
  // Rol classia_app (sin superuser) -- la conexion real de runtime, para que
  // Row-Level Security aplique (ver docs/planning/aislamiento-rls-multitenant.md,
  // trampa #0/#7: DATABASE_URL usa "classia", que es superuser y siempre ignora
  // RLS, ni con FORCE).
  //
  // OBLIGATORIA a proposito. Hasta el 2026-07-26 era opcional y database.config.ts
  // caia a DATABASE_URL cuando faltaba: eso arrancaba la app como superuser, con
  // las politicas presentes y ninguna fila protegida, sin un solo error. Es el modo
  // de falla mas peligroso que tiene el repo porque parece que todo funciona, y
  // `pnpm verify:rls` no lo detecta (se conecta con DATABASE_URL por diseño).
  // Preferimos que el arranque falle ruidosamente antes que degradar el aislamiento
  // en silencio.
  // El mensaje va en required_error Y en url(): si solo estuviera en url(), la ausencia
  // de la variable -- que es el caso que importa -- fallaria con el "Required" pelado de
  // Zod, sin decir por que.
  DATABASE_URL_APP: z
    .string({
      required_error: MISSING_APP_URL_MESSAGE,
      invalid_type_error: MISSING_APP_URL_MESSAGE,
    })
    .url({ message: MISSING_APP_URL_MESSAGE }),
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
