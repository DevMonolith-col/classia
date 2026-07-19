import { BullModule, InjectQueue } from "@nestjs/bullmq"
import { Module, OnModuleInit } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { Queue } from "bullmq"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { AuditCoreModule } from "../../core/audit/audit-core.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { AccessControlController } from "./access-control.controller"
import { AccessSessionExpiryProcessor } from "./access-session-expiry.processor"
import { ACCESS_SESSION_EXPIRY_QUEUE, AccessControlService, EXPIRY_SWEEP_INTERVAL_MS } from "./access-control.service"

@Module({
  imports: [
    AuditCoreModule,
    NotificationsModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: ACCESS_SESSION_EXPIRY_QUEUE }),
  ],
  controllers: [AccessControlController],
  providers: [JwtAuthGuard, AccessControlService, AccessSessionExpiryProcessor],
  exports: [AccessControlService],
})
export class AccessControlModule implements OnModuleInit {
  constructor(@InjectQueue(ACCESS_SESSION_EXPIRY_QUEUE) private readonly queue: Queue) {}

  // jobId estable: si el proceso se reinicia, BullMQ no duplica el scheduler
  // repetible — lo reconoce como el mismo y lo deja como está en vez de crear
  // uno nuevo en paralelo.
  async onModuleInit() {
    await this.queue.add(
      "sweep",
      {},
      {
        repeat: { every: EXPIRY_SWEEP_INTERVAL_MS },
        jobId: "access-session-expiry-sweep",
        removeOnComplete: true,
        removeOnFail: true,
      },
    )
  }
}
