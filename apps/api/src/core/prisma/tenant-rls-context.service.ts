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

  // async + await INTERNO (no "return this.als.run(store, callback)" a secas):
  // las queries de Prisma son lazy (PrismaPromise no dispara $allOperations
  // hasta que algo llama .then()/await sobre ellas). Si el callback del
  // caller es un arrow plano tipo `() => this.prisma.modelo.metodo(args)`
  // (sin await propio adentro), ese .then() ocurre en el `await
  // runWithTenant(...)` del CALLER -- que ya corre FUERA de la ventana
  // síncrona de `als.run()`, así que AsyncLocalStorage pierde el contexto y
  // la extensión ve `getStore() === undefined` -- RLS filtra todo (login()
  // encontrado en vivo 2026-07-23: la membership existía y estaba ACTIVE en
  // la BD, pero el store llegaba undefined a la extensión). Al await-ear acá
  // ADENTRO del callback que le pasamos a `als.run`, el .then() real queda
  // enganchado mientras el contexto todavía está activo, sin importar cómo
  // haya escrito su callback quien llama.
  async runWithTenant<T>(tenantId: string, callback: () => T | Promise<T>): Promise<T> {
    return this.als.run({ tenantId }, async () => {
      return await callback();
    });
  }

  async runInTransaction<T>(tenantId: string, callback: () => T | Promise<T>): Promise<T> {
    return this.als.run({ tenantId, inTransaction: true }, async () => {
      return await callback();
    });
  }

  getStore(): TenantRlsStore | undefined {
    return this.als.getStore();
  }
}
