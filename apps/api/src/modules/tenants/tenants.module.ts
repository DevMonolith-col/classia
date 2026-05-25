import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { TenantContextModule } from "../../core/tenant-context/tenant-context.module";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [JwtModule.register({}), TenantContextModule],
  controllers: [TenantsController],
  providers: [JwtAuthGuard, PermissionsGuard, TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
