import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import { envSchema } from "./config/env.schema";
import redisConfig from "./config/redis.config";
import { AuditCoreModule } from "./core/audit/audit-core.module";
import { PrismaModule } from "./core/prisma/prisma.module";
import { QueueModule } from "./core/queue/queue.module";
import { RedisModule } from "./core/redis/redis.module";
import { TenantContextModule } from "./core/tenant-context/tenant-context.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", "../../.env.example"],
      validate: (config) => envSchema.parse(config),
      load: [appConfig, databaseConfig, redisConfig],
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    AuditCoreModule,
    TenantContextModule,
    HealthModule,
    TenantsModule,
    AuthModule,
    UsersModule,
    AuditModule,
  ],
})
export class AppModule {}
