import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

// Cliente de BYPASS real (rol Postgres classia_platform_admin, BYPASSRLS —
// docs/planning/aislamiento-rls-multitenant.md, trampa #5). Uso exclusivo:
// el puñado de lecturas genuinamente cross-tenant de SUPER_ADMIN/soporte
// (dashboards agregados, listado de tenants) y el job "sweep" de expiración
// de accesos (Fase 6) — nunca como reemplazo cómodo de PrismaService.
// Cualquier código que lo use está afirmando explícitamente "esta operación
// necesita ver a través de todos los colegios", así que cada uso debe poder
// justificarse por nombre de método, no por conveniencia.
@Injectable()
export class PlatformAdminPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformAdminPrismaService.name);
  private client: PrismaClient | undefined;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>("database.platformAdminUrl");
    if (!url) {
      this.logger.warn(
        "DATABASE_URL_PLATFORM_ADMIN no está configurada — PlatformAdminPrismaService lanzará si algo intenta usarla.",
      );
      return;
    }
    this.client = new PrismaClient({ datasources: { db: { url } } });
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }

  // Getter, no propiedad pública: fuerza a que cada caller pase por acá y
  // deje un rastro de "necesité el bypass" en su propio código, en vez de
  // inyectar el PrismaClient de bypass directamente en el constructor.
  get(): PrismaClient {
    if (!this.client) {
      throw new Error(
        "PlatformAdminPrismaService no está inicializado (falta DATABASE_URL_PLATFORM_ADMIN). No se puede hacer una lectura cross-tenant sin este cliente.",
      );
    }
    return this.client;
  }
}
