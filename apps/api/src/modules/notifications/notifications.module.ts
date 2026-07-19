import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { EmailService } from "./email/email.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsListeners } from "./notifications.listeners";
import { NotificationsProcessor } from "./notifications.processor";
import { NOTIFICATIONS_QUEUE, NotificationsService } from "./notifications.service";

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }), DataScopeModule, JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    JwtAuthGuard,
    PermissionsGuard,
    NotificationsService,
    NotificationsListeners,
    NotificationsProcessor,
    EmailService,
  ],
  exports: [EmailService, NotificationsService],
})
export class NotificationsModule {}
