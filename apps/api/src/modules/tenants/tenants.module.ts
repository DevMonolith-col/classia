import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DataScopeModule } from "../../common/guards/data-scope.module";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { TenantContextModule } from "../../core/tenant-context/tenant-context.module";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [AuditCoreModule, DataScopeModule, JwtModule.register({}), TenantContextModule],
  controllers: [TenantsController],
  providers: [JwtAuthGuard, PermissionsGuard, TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
