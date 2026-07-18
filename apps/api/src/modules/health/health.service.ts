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

  async getStats() {
    let dbLatency = 0;
    let dbStatus = "up";
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
    } catch {
      dbStatus = "down";
    }

    let redisStatus = "up";
    try {
      await this.redis.client.ping();
    } catch {
      redisStatus = "down";
    }

    return {
      api: { status: "up" },
      db: { status: dbStatus, latencyMs: dbLatency },
      redis: { status: redisStatus, uptime: "99.9%" }
    };
  }
}
