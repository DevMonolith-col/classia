import { registerAs } from "@nestjs/config";

export default registerAs("database", () => ({
  url: process.env.DATABASE_URL,
  // Ver env.schema.ts: rol sin superuser, la conexion real de runtime. SIN fallback
  // a DATABASE_URL -- ese rol es superuser e ignora RLS, asi que caer ahi apagaria
  // el aislamiento multi-tenant sin ningun error visible. envSchema la exige, de
  // modo que si falta el arranque falla antes de llegar aca.
  appUrl: process.env.DATABASE_URL_APP,
  platformAdminUrl: process.env.DATABASE_URL_PLATFORM_ADMIN,
}));
