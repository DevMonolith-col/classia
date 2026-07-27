import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuditCoreModule, DataScopeModule, JwtModule.register({})],
  controllers: [OnboardingController],
  providers: [JwtAuthGuard, PermissionsGuard, OnboardingService],
})
export class OnboardingModule {}
