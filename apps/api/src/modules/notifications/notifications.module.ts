import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { EmailService } from "./email/email.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsListeners } from "./notifications.listeners";
import { NotificationsProcessor } from "./notifications.processor";
import { NOTIFICATIONS_QUEUE, NotificationsService } from "./notifications.service";

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }), JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    JwtAuthGuard,
    PermissionsGuard,
    NotificationsService,
    NotificationsListeners,
    NotificationsProcessor,
    EmailService,
  ],
})
export class NotificationsModule {}
