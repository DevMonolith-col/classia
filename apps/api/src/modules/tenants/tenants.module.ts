import { Module } from "@nestjs/common";
import { TenantContextModule } from "../../core/tenant-context/tenant-context.module";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [TenantContextModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
