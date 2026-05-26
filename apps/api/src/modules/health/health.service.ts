import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";
import { RedisService } from "../../core/redis/redis.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.redis.client.ping();

    return {
      status: "ok",
      service: "classia-api",
      timestamp: new Date().toISOString(),
    };
  }
}
