import { Global, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { PlatformAdminPrismaService } from "./platform-admin-prisma.service";
import { PrismaService } from "./prisma.service";
import { tenantRlsExtension } from "./tenant-rls.extension";
import { TenantRlsContextService } from "./tenant-rls-context.service";

// El PrismaClient base vive acá (no dentro de la clase PrismaService) porque
// $extends() devuelve un objeto nuevo que NO conserva métodos custom de una
// subclase (onModuleInit/onModuleDestroy) — solo conserva la API propia de
// Prisma ($connect, $transaction, los delegates de modelo, etc.). Por eso el
// connect/disconnect del cliente real se maneja acá, en el módulo, en vez de
// depender de que Nest detecte esos hooks en el objeto extendido.
let rawClient: PrismaClient | undefined;

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: (config: ConfigService, tenantRlsContext: TenantRlsContextService) => {
        // DATABASE_URL_APP (rol "classia_app", sin superuser) — NUNCA
        // DATABASE_URL ("classia", superuser): un superuser ignora Row-Level
        // Security sin excepción, ni con FORCE (docs/planning/aislamiento-rls-multitenant.md,
        // trampa #0/#7, verificado en vivo).
        const url = config.get<string>("database.appUrl");
        rawClient = new PrismaClient({ datasources: { db: { url } } });
        return tenantRlsExtension(tenantRlsContext)(rawClient) as unknown as PrismaService;
      },
      inject: [ConfigService, TenantRlsContextService],
    },
    TenantRlsContextService,
    PlatformAdminPrismaService,
  ],
  exports: [PrismaService, TenantRlsContextService, PlatformAdminPrismaService],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await rawClient?.$connect();
  }

  async onModuleDestroy() {
    await rawClient?.$disconnect();
  }
}
