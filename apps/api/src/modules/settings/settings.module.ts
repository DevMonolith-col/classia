import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { EmailModule } from "../notifications/email/email.module";

@Module({
  imports: [PrismaModule, DataScopeModule, EmailModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
