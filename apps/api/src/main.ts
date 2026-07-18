import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";
import { RedisService } from "./core/redis/redis.service";
import { RedisIoAdapter } from "./core/realtime/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("app.port", 3001);

  setupApp(app);

  const redisService = app.get(RedisService);
  const redisIoAdapter = new RedisIoAdapter(app, redisService, config);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(port);
}

void bootstrap();
