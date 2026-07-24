// Fase 3 de docs/planning/aislamiento-rls-multitenant.md: guardarraíl
// preventivo para que un modelo NUEVO nunca se quede sin clasificar.
//
// El criterio es deliberadamente el opuesto de "buscar modelos con
// tenantId": ese enfoque es exactamente el que dejó pasar las 21 tablas de
// la Fase 1 (tenían tenantId indirecto, vía un padre, y nada las marcaba
// como pendientes). Acá el criterio es una lista blanca EXPLÍCITA y
// deliberadamente corta de lo que es genuinamente global -- todo lo demás,
// sin excepción, debe tener RLS habilitado y forzado. Un modelo nuevo que
// no se agregue a ninguna lista falla el script por default, no al revés.
//
// Uso: `pnpm verify:rls` (carga .env/.env.example vía dotenv-cli, corre
// contra la base de datos real -- pensado para correr después de aplicar
// migraciones, en CI o a mano).
import { Prisma, PrismaClient } from "@prisma/client";

// Tablas genuinamente sin aislamiento por tenant. Cada una necesita una
// razón explícita acá -- agregar una tabla a esta lista sin justificarla es
// exactamente el tipo de "opt-out silencioso" que este script existe para
// prevenir.
const GLOBAL_ALLOWLIST: Record<string, string> = {
  tenants: "es la tabla que define los tenants -- no puede depender de sí misma.",
  users: "un usuario puede pertenecer a varios colegios via TenantMembership; el aislamiento real vive en tenant_memberships, no acá.",
  system_settings: "configuración global de la plataforma, no de un colegio.",
  notification_preferences: "pendiente de decisión de producto (ver Fase 1 del plan) -- sin tenantId todavía a propósito.",
};

// Tablas con tenantId nullable por diseño (sesiones/acciones de plataforma
// sin colegio asociado) -- SÍ llevan RLS forzado, pero con una política que
// además deja pasar tenantId IS NULL. Se verifican igual que las estándar
// en cuanto a ENABLE/FORCE; están separadas acá solo para que el reporte
// las etiquete distinto, no como una tercera categoría de excepción.
const NULLABLE_TENANT_TABLES = new Set(["auth_sessions", "audit_logs"]);

type TableFlags = {
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
};

async function main() {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>(
      Prisma.sql`
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `,
    );
    const dbFlags = new Map<string, TableFlags>(
      rows.map((r) => [r.relname, { relrowsecurity: r.relrowsecurity, relforcerowsecurity: r.relforcerowsecurity }]),
    );

    const models = Prisma.dmmf.datamodel.models;
    const failures: string[] = [];
    const warnings: string[] = [];
    let okStandard = 0;
    let okNullable = 0;
    let okGlobal = 0;

    for (const model of models) {
      const tableName = model.dbName ?? model.name;
      const flags = dbFlags.get(tableName);

      if (!flags) {
        failures.push(
          `- "${tableName}" (modelo ${model.name}): no existe en la base de datos consultada. ` +
            `¿Falta aplicar una migración?`,
        );
        continue;
      }

      if (tableName in GLOBAL_ALLOWLIST) {
        if (flags.relrowsecurity || flags.relforcerowsecurity) {
          warnings.push(
            `- "${tableName}": está en la lista blanca de tablas globales (${GLOBAL_ALLOWLIST[tableName]}) ` +
              `pero tiene RLS habilitado en la base de datos. No es una fuga (RLS de más no filtra de menos), ` +
              `pero es una discrepancia entre el código y el schema real -- revisar si sigue perteneciendo a la lista blanca.`,
          );
        }
        okGlobal += 1;
        continue;
      }

      if (!flags.relrowsecurity || !flags.relforcerowsecurity) {
        failures.push(
          `- "${tableName}" (modelo ${model.name}): NO tiene RLS habilitado/forzado. ` +
            `Ni está en la lista blanca de tablas globales. Fix: ` +
            `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY; ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY; ` +
            `más su política -- ver packages/database/prisma/migrations/20260722110000_rls_enable_force_policies/migration.sql ` +
            `como referencia del patrón. Si "${tableName}" es genuinamente global, agregala a GLOBAL_ALLOWLIST en este script ` +
            `con una razón explícita, no la dejes sin clasificar.`,
        );
        continue;
      }

      if (NULLABLE_TENANT_TABLES.has(tableName)) {
        okNullable += 1;
      } else {
        okStandard += 1;
      }
    }

    // Tablas presentes en la BD que no corresponden a NINGÚN modelo de
    // Prisma (tablas huérfanas de una migración vieja, o creadas a mano) no
    // se reportan acá a propósito -- el objetivo de este script es que todo
    // MODELO esté clasificado, no auditar la BD entera byte a byte.

    const total = models.length;
    console.log(`Fase 3 -- verificación de RLS: ${total} modelos de Prisma revisados.`);
    console.log(`  ✅ ${okStandard} con política estándar (tenantId NOT NULL).`);
    console.log(`  ✅ ${okNullable} con política nullable-tenant (auth_sessions/audit_logs).`);
    console.log(`  ✅ ${okGlobal} en la lista blanca de tablas globales, sin RLS.`);

    if (warnings.length > 0) {
      console.log(`\n⚠️  ${warnings.length} advertencia(s) (no fallan el script):`);
      warnings.forEach((w) => console.log(w));
    }

    if (failures.length > 0) {
      console.log(`\n❌ ${failures.length} modelo(s) sin clasificar o sin RLS forzado:`);
      failures.forEach((f) => console.log(f));
      console.log("\nverify:rls FALLÓ.");
      process.exitCode = 1;
      return;
    }

    console.log("\nverify:rls OK -- todos los modelos están clasificados.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("verify:rls: error inesperado.", error);
  process.exitCode = 1;
});
