import { Prisma, PrismaClient } from "@prisma/client";
import { TenantRlsContextService } from "./tenant-rls-context.service";

// Setea "app.tenant_id" (vía set_config, parametrizado — nunca interpolación
// de string, para no abrir la puerta a inyección SQL) antes de cada
// operación de Prisma, en la MISMA conexión/transacción que la query real
// (forma array de $transaction — validado en vivo el 2026-07-22 que ambas
// comparten conexión). Es el mecanismo de CONVENIENCIA para poblar el
// contexto que Postgres usa en sus políticas de RLS; la garantía de
// aislamiento en sí la da RLS, no esta extensión (si esta extensión tiene
// un bug y nunca corre, RLS de todos modos rechaza todo por default — falla
// cerrado, no abierto).
//
// Si `tenantRlsContext.getStore()?.inTransaction` es true, la operación ya
// está corriendo dentro de una transacción abierta por
// `runInTenantTransaction`, que ya seteó app.tenant_id al principio — acá
// NO hay que abrir otra mini-transacción (Prisma no soporta anidar
// $transaction, y aunque lo soportara, correría en una conexión distinta a
// la de la transacción ya abierta, dejando el SET LOCAL sin efecto sobre
// la query real).
export function tenantRlsExtension(tenantRlsContext: TenantRlsContextService) {
  return (client: PrismaClient) =>
    client.$extends({
      name: "tenant-rls",
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const store = tenantRlsContext.getStore();
            if (!store?.tenantId || store.inTransaction) {
              return query(args);
            }

            const [, result] = await client.$transaction([
              client.$executeRaw`SELECT set_config('app.tenant_id', ${store.tenantId}, true)`,
              query(args) as unknown as Prisma.PrismaPromise<unknown>,
            ]);
            return result;
          },
        },
      },
    });
}
