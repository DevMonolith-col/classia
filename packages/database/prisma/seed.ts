import { randomBytes } from "node:crypto";
import { PrismaClient, TenantStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const demoPassword = "ClassiaDemo2026!";

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {
      name: "Colegio Demo Classia",
      primaryDomain: "app.demo.classia.com.co",
      status: TenantStatus.DEMO,
      brandColor: "#2563eb",
    },
    create: {
      name: "Colegio Demo Classia",
      slug: "demo",
      primaryDomain: "app.demo.classia.com.co",
      status: TenantStatus.DEMO,
      brandColor: "#2563eb",
    },
  });

  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@classia.com.co" },
    update: {
      firstName: "Admin",
      lastName: "Classia",
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      email: "admin@classia.com.co",
      passwordHash,
      firstName: "Admin",
      lastName: "Classia",
      status: UserStatus.ACTIVE,
    },
  });

  const tenantAdmin = await prisma.user.upsert({
    where: { email: "rector@demo.classia.com.co" },
    update: {
      firstName: "Rector",
      lastName: "Demo",
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      email: "rector@demo.classia.com.co",
      passwordHash,
      firstName: "Rector",
      lastName: "Demo",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: superAdmin.id,
      },
    },
    update: {
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      tenantId: tenant.id,
      userId: superAdmin.id,
      role: UserRole.SUPER_ADMIN,
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: tenantAdmin.id,
      },
    },
    update: {
      role: UserRole.TENANT_ADMIN,
    },
    create: {
      tenantId: tenant.id,
      userId: tenantAdmin.id,
      role: UserRole.TENANT_ADMIN,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: superAdmin.id,
      action: "seed.demo_created",
      entityType: "Tenant",
      entityId: tenant.id,
      newValues: {
        note: "Demo seed executed",
        runId: randomBytes(8).toString("hex"),
      },
    },
  });

  console.log("Demo seed completed.");
  console.log(`Demo password for development only: ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
