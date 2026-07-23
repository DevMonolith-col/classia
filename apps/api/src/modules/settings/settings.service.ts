import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";
import { runInTenantTransaction } from "../../core/prisma/run-in-tenant-transaction";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import { UpdateSettingsDto } from "./settings.schemas";

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
  ) {}

  async getSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const result: Record<string, any> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    return result;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    // SystemSetting es global (sin tenantId, sin RLS) -- el tenantId acá
    // solo evita anidar transacciones dentro de la extensión de Prisma
    // (docs/planning/aislamiento-rls-multitenant.md, trampa #3), no scopea
    // nada realmente. Solo llega acá un SUPER_ADMIN (gateado en el
    // controller), que siempre tiene tenantId en su contexto.
    const tenantId = this.tenantRlsContext.getStore()?.tenantId ?? "platform";
    await runInTenantTransaction(this.prisma, this.tenantRlsContext, tenantId, async (tx) => {
      for (const [key, value] of Object.entries(dto)) {
        // TypeScript compiler complains without 'as any' for value if value is union type that Prisma doesn't perfectly match for Json
        await tx.systemSetting.upsert({
          where: { key },
          update: { value: value as any },
          create: { key, value: value as any },
        });
      }
    });
    return this.getSettings();
  }
}
