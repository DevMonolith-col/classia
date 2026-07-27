import { Module } from "@nestjs/common";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { DemoRequestsController } from "./demo-requests.controller";
import { DemoRequestsService } from "./demo-requests.service";

@Module({
  imports: [PrismaModule, AuditCoreModule, DataScopeModule],
  controllers: [DemoRequestsController],
  providers: [DemoRequestsService],
})
export class DemoRequestsModule {}
