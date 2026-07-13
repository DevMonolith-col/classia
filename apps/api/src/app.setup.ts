import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const PRIVATE_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("app.nodeEnv", "development");
  const webUrl = config.get<string>("app.webUrl", "http://localhost:3000");
  const explicitOrigins = config.get<string[]>("app.corsOrigins") ?? [webUrl];

  // 1. Confiar en proxies inversos (Coolify/Cloudflare) para resolver la IP real del cliente
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp.set === "function") {
    expressApp.set("trust proxy", true);
  }

  // 2. Regex para validar subdominios dinámicos del SaaS (ej. app.colegio.classia.com.co)
  const domain = config.get<string>("app.domain", "classia.com.co");
  const escapedDomain = domain.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const tenantOriginRegex = new RegExp(
    `^https?:\\/\\/([a-zA-Z0-9-]+\\.)*${escapedDomain}(:\\d+)?$`,
  );

  app.use(helmet());
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) return callback(null, true);

      // Permitir IPs privadas / localhost en desarrollo
      if (
        nodeEnv === "development" &&
        PRIVATE_ORIGIN.test(origin)
      ) {
        return callback(null, true);
      }

      // Permitir dinámicamente cualquier subdominio del dominio principal
      if (tenantOriginRegex.test(origin)) {
        return callback(null, true);
      }

      // Permitir dominios explícitos configurados (dominios propios de colegios)
      if (explicitOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter(config));
}
