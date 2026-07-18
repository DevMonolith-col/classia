import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../redis/redis.service';
import { buildCorsOptions } from '../../app.setup';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication, private readonly redis: RedisService, private readonly config: ConfigService) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = this.redis.client.duplicate();
    const subClient = this.redis.client.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      transports: ['websocket'],
      cors: buildCorsOptions(this.config),
    });
    server.adapter(this.adapterConstructor);
    return server;
  }
}
