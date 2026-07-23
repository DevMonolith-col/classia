import { Injectable } from "@nestjs/common";
import { PlatformAdminPrismaService } from "../../core/prisma/platform-admin-prisma.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { RedisService } from "../../core/redis/redis.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly platformAdmin: PlatformAdminPrismaService,
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

    let openTickets = 0;
    let closedTickets = 0;
    if (dbStatus === "up") {
      try {
        // Genuinamente cross-tenant: el conteo de tickets es plataforma-wide
        // (solo lo ve SUPER_ADMIN, gateado en el controller). Bypass explícito.
        const counts = await this.platformAdmin.get().supportTicket.groupBy({
          by: ['status'],
          _count: { status: true }
        });
        
        counts.forEach(c => {
          if (["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"].includes(c.status)) {
            openTickets += c._count.status;
          } else if (["RESOLVED", "CLOSED"].includes(c.status)) {
            closedTickets += c._count.status;
          }
        });
      } catch {
        // Ignore DB errors for stats
      }
    }

    return {
      api: { status: "up" },
      db: { status: dbStatus, latencyMs: dbLatency },
      redis: { status: redisStatus, uptime: "99.9%" },
      support: {
        openTickets,
        closedTickets
      }
    };
  }
}
