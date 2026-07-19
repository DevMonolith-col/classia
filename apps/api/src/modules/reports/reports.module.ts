import { BullModule } from "@nestjs/bullmq"
import { Module, OnModuleInit } from "@nestjs/common"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { AuditCoreModule } from "../../core/audit/audit-core.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { PaymentsModule } from "../payments/payments.module"
import { ReportCardsModule } from "../report-cards/report-cards.module"
import { ReportsController } from "./reports.controller"
import { ReportsProcessor } from "./reports.processor"
import { REPORTS_QUEUE, ReportsService } from "./reports.service"

@Module({
  imports: [BullModule.registerQueue({ name: REPORTS_QUEUE }), AuditCoreModule, PaymentsModule, ReportCardsModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [JwtAuthGuard, PermissionsGuard, ReportsService, ReportsProcessor],
})
export class ReportsModule implements OnModuleInit {
  constructor(private readonly reports: ReportsService) {}

  // Los jobs recurrentes de BullMQ viven en Redis; si Redis se reinició sin
  // persistir, esto los vuelve a registrar al arrancar la API.
  async onModuleInit() {
    await this.reports.reconcileSchedulers()
  }
}
