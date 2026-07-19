import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando migración histórica de Años Académicos...");

  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    console.log(`\nProcesando tenant: ${tenant.name} (${tenant.id})`);

    const activeYear = await prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isActive: true },
    });

    if (!activeYear) {
      console.warn(`⚠️ No hay un Año Académico activo para el tenant ${tenant.id}. Omitiendo...`);
      continue;
    }

    console.log(`Año activo encontrado: ${activeYear.name} (${activeYear.id})`);

    // Migrar Tareas (Homework)
    const homeworkResult = await prisma.homework.updateMany({
      where: {
        tenantId: tenant.id,
        academicYearId: null,
      },
      data: {
        academicYearId: activeYear.id,
      },
    });

    console.log(`✅ ${homeworkResult.count} asignaciones actualizadas.`);

    // Migrar Notas (Marks)
    const marksResult = await prisma.mark.updateMany({
      where: {
        tenantId: tenant.id,
        academicYearId: null,
      },
      data: {
        academicYearId: activeYear.id,
      },
    });

    console.log(`✅ ${marksResult.count} calificaciones actualizadas.`);
  }

  console.log("\n🚀 Migración finalizada con éxito.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
