import { registerAs } from "@nestjs/config";

export default registerAs("database", () => ({
  url: process.env.DATABASE_URL,
  // Ver env.schema.ts: rol sin superuser, la conexion real de runtime.
  appUrl: process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL,
  platformAdminUrl: process.env.DATABASE_URL_PLATFORM_ADMIN,
}));
