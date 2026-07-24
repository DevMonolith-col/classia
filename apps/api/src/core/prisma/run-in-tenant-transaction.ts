import { Prisma, PrismaClient } from "@prisma/client";
import { TenantRlsContextService } from "./tenant-rls-context.service";

// Único punto sancionado para abrir una transacción de negocio en todo el
// repo (docs/planning/aislamiento-rls-multitenant.md, trampa #3). Reemplaza
// las 17 llamadas directas a `prisma.$transaction(...)` que existían antes
// de la Fase 2: cada una se migra a `runInTenantTransaction(prisma,
// tenantId, async (tx) => {...})`, usando `tx` adentro exactamente como se
// usaba el `tx` de `prisma.$transaction(async (tx) => {...})` — mismo
// callback interactivo, misma API. La única diferencia es que ahora
// `app.tenant_id` queda seteado UNA vez al principio de esta transacción
// (compartiendo conexión, porque `tx.$executeRaw` y el resto de las
// operaciones dentro del callback corren todas en la misma conexión de la
// transacción interactiva), y el contexto (`inTransaction: true`) le avisa
// a la extensión de Prisma que no intente abrir otra transacción anidada
// para las queries dentro del callback.
export async function runInTenantTransaction<T>(
  prisma: PrismaClient,
  tenantRlsContext: TenantRlsContextService,
  tenantId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return tenantRlsContext.runInTransaction(tenantId, () => callback(tx));
  });
}
