import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { TenantRlsContextService } from "./tenant-rls-context.service";

@Global()
@Module({
  providers: [PrismaService, TenantRlsContextService],
  exports: [PrismaService, TenantRlsContextService],
})
export class PrismaModule {}
