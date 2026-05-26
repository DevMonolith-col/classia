import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>("redis.url") ?? "redis://localhost:6379",
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
