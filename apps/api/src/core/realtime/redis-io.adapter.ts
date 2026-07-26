import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../redis/redis.service';
import { buildCorsOptions } from '../../app.setup';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;
  // Se guardan para poder cerrarlos: son `duplicate()` del cliente global, así que Nest no
  // los conoce y `app.close()` no los toca. En el proceso del servidor da igual (muere
  // entero), pero en los tests deja el event loop vivo y jest no termina — se detectó así.
  private pubClient?: ReturnType<RedisService["client"]["duplicate"]>;
  private subClient?: ReturnType<RedisService["client"]["duplicate"]>;

  constructor(app: INestApplication, private readonly redis: RedisService, private readonly config: ConfigService) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    this.pubClient = this.redis.client.duplicate();
    this.subClient = this.redis.client.duplicate();
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }

  /**
   * Cierra las dos conexiones pub/sub. Llamarlo es obligatorio en tests (si no, jest queda
   * colgado tras terminar) y correcto en un apagado ordenado del servidor.
   */
  async disconnectFromRedis(): Promise<void> {
    await Promise.allSettled([this.pubClient?.quit(), this.subClient?.quit()]);
    this.pubClient = undefined;
    this.subClient = undefined;
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
