import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  domain: process.env.APP_DOMAIN ?? "classia.com.co",
  webUrl: process.env.APP_WEB_URL ?? "http://localhost:3000",
  corsOrigins: process.env.APP_CORS_ORIGINS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  apiUrl: process.env.APP_API_URL ?? "http://localhost:3001",
}));
