import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

// Propaga el tenantId activo a lo largo de la cadena async de un request
// (o de un job de BullMQ, Fase 6) para que la extensión de Prisma
// (tenant-rls.extension.ts) sepa qué "app.tenant_id" setear en cada query,
// sin tener que pasarlo a mano por cada función. Esto es SOLO conveniencia
// de desarrollo: la garantía real de aislamiento es Row-Level Security en
// Postgres (ver docs/planning/aislamiento-rls-multitenant.md) — si este
// contexto se pierde por algún bug, RLS falla cerrado (cero filas), no
// abierto.
//
// `inTransaction: true` es lo que le dice a la extensión "no intentes abrir
// tu propia mini-transacción para setear app.tenant_id — ya corrió al
// principio de la transacción que abrió runInTenantTransaction". No se
// puede detectar esto inspeccionando el cliente Prisma (`this` dentro de
// $allOperations no es el cliente, es un array interno de argumentos,
// confirmado con una prueba directa) — por eso es un flag explícito acá.
export type TenantRlsStore = {
  tenantId: string;
  inTransaction?: boolean;
};

@Injectable()
export class TenantRlsContextService {
  private readonly als = new AsyncLocalStorage<TenantRlsStore>();

  runWithTenant<T>(tenantId: string, callback: () => T): T {
    return this.als.run({ tenantId }, callback);
  }

  runInTransaction<T>(tenantId: string, callback: () => T): T {
    return this.als.run({ tenantId, inTransaction: true }, callback);
  }

  getStore(): TenantRlsStore | undefined {
    return this.als.getStore();
  }
}
