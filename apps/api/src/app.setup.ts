import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const webUrl = config.get<string>("app.webUrl", "http://localhost:3000");
  const corsOrigins = config.get<string[]>("app.corsOrigins") ?? [webUrl];

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter(config));
}
