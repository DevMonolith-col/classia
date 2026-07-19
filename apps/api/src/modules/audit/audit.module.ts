import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditController } from "./audit.controller";
import { AuditQueryService } from "./audit.service";

@Module({
  imports: [JwtModule.register({}), DataScopeModule],
  controllers: [AuditController],
  providers: [AuditQueryService, JwtAuthGuard, PermissionsGuard],
})
export class AuditModule {}
