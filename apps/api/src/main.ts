import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("app.port", 3005);
  const webUrl = config.get<string>("app.webUrl", "http://localhost:3000");

  app.use(helmet());
  app.enableCors({
    origin: [webUrl],
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter(config));

  await app.listen(port);
}

void bootstrap();
