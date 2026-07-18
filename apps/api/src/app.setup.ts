import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const PRIVATE_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
export function buildCorsOptions(config: ConfigService) {
  const nodeEnv = config.get<string>("app.nodeEnv", "development");
  const webUrl = config.get<string>("app.webUrl", "http://localhost:3000");
  const explicitOrigins = config.get<string[]>("app.corsOrigins") ?? [webUrl];

  const tenantOriginRegex = new RegExp(
    `^https?:\\/\\/([a-zA-Z0-9-]+\\.)*${escapedDomain}(:\\d+)?$`,
  );

  return {
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) return callback(null, true);

      if (nodeEnv === "development" && PRIVATE_ORIGIN.test(origin)) {
        return callback(null, true);
      }

      if (tenantOriginRegex.test(origin)) {
        return callback(null, true);
      }

      if (explicitOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  };
}

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp.set === "function") {
    expressApp.set("trust proxy", true);
  }

  app.use(helmet());
  app.enableCors(buildCorsOptions(config));

  app.useGlobalFilters(new HttpExceptionFilter(config));
}
