import { randomBytes } from "node:crypto";
import {
  PrismaClient,
  TenantStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
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

  // Usuario profesor demo
  const teacherUser = await prisma.user.upsert({
    where: { email: "lopez@demo.classia.co" },
    update: { firstName: "Juan", lastName: "López", status: UserStatus.ACTIVE, passwordHash },
    create: { email: "lopez@demo.classia.co", passwordHash, firstName: "Juan", lastName: "López", status: UserStatus.ACTIVE },
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: teacherUser.id } },
    update: { role: UserRole.TEACHER },
    create: { tenantId: tenant.id, userId: teacherUser.id, role: UserRole.TEACHER },
  });

  // Usuario acudiente demo
  const guardianUser = await prisma.user.upsert({
    where: { email: "rosa@demo.classia.co" },
    update: { firstName: "Rosa", lastName: "García", status: UserStatus.ACTIVE, passwordHash },
    create: { email: "rosa@demo.classia.co", passwordHash, firstName: "Rosa", lastName: "García", status: UserStatus.ACTIVE },
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: guardianUser.id } },
    update: { role: UserRole.GUARDIAN },
    create: { tenantId: tenant.id, userId: guardianUser.id, role: UserRole.GUARDIAN },
  });

  const [group5A, group6B] = await Promise.all([
    prisma.group.upsert({
      where: {
        id: "11111111-1111-4111-8111-111111111111",
      },
      update: {
        tenantId: tenant.id,
        name: "5to Grado A",
        grade: "5to Grado",
        section: "A",
      },
      create: {
        id: "11111111-1111-4111-8111-111111111111",
        tenantId: tenant.id,
        name: "5to Grado A",
        grade: "5to Grado",
        section: "A",
      },
    }),
    prisma.group.upsert({
      where: {
        id: "22222222-2222-4222-8222-222222222222",
      },
      update: {
        tenantId: tenant.id,
        name: "6to Grado B",
        grade: "6to Grado",
        section: "B",
      },
      create: {
        id: "22222222-2222-4222-8222-222222222222",
        tenantId: tenant.id,
        name: "6to Grado B",
        grade: "6to Grado",
        section: "B",
      },
    }),
  ]);

  const [mathSubject, spanishSubject] = await Promise.all([
    prisma.subject.upsert({
      where: {
        id: "33333333-3333-4333-8333-333333333333",
      },
      update: {
        tenantId: tenant.id,
        name: "Matemáticas",
        code: "MAT-01",
      },
      create: {
        id: "33333333-3333-4333-8333-333333333333",
        tenantId: tenant.id,
        name: "Matemáticas",
        code: "MAT-01",
      },
    }),
    prisma.subject.upsert({
      where: {
        id: "44444444-4444-4444-8444-444444444444",
      },
      update: {
        tenantId: tenant.id,
        name: "Español",
        code: "ESP-01",
      },
      create: {
        id: "44444444-4444-4444-8444-444444444444",
        tenantId: tenant.id,
        name: "Español",
        code: "ESP-01",
      },
    }),
  ]);

  const teacherProfile = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {
      tenantId: tenant.id,
    },
    create: {
      userId: teacherUser.id,
      tenantId: tenant.id,
    },
  });

  const guardianProfile = await prisma.guardian.upsert({
    where: { userId: guardianUser.id },
    update: {
      tenantId: tenant.id,
    },
    create: {
      userId: guardianUser.id,
      tenantId: tenant.id,
    },
  });

  // Usuario estudiante demo (para iniciar sesión en el portal de alumno)
  const studentUser = await prisma.user.upsert({
    where: { email: "maria@demo.classia.co" },
    update: { firstName: "María", lastName: "García López", status: UserStatus.ACTIVE, passwordHash },
    create: { email: "maria@demo.classia.co", passwordHash, firstName: "María", lastName: "García López", status: UserStatus.ACTIVE },
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: studentUser.id } },
    update: { role: UserRole.STUDENT },
    create: { tenantId: tenant.id, userId: studentUser.id, role: UserRole.STUDENT },
  });

  const [studentMaria, studentDiego] = await Promise.all([
    prisma.student.upsert({
      where: {
        tenantId_documentId: {
          tenantId: tenant.id,
          documentId: "STU-1001",
        },
      },
      update: {
        firstName: "María",
        lastName: "García López",
        groupId: group5A.id,
        isActive: true,
        userId: studentUser.id,
      },
      create: {
        tenantId: tenant.id,
        firstName: "María",
        lastName: "García López",
        documentId: "STU-1001",
        birthDate: new Date("2014-03-10T00:00:00.000Z"),
        groupId: group5A.id,
        isActive: true,
        userId: studentUser.id,
      },
    }),
    prisma.student.upsert({
      where: {
        tenantId_documentId: {
          tenantId: tenant.id,
          documentId: "STU-1002",
        },
      },
      update: {
        firstName: "Diego",
        lastName: "Mendoza Ruiz",
        groupId: group6B.id,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        firstName: "Diego",
        lastName: "Mendoza Ruiz",
        documentId: "STU-1002",
        birthDate: new Date("2013-09-21T00:00:00.000Z"),
        groupId: group6B.id,
        isActive: true,
      },
    }),
  ]);

  await prisma.studentGuardian.deleteMany({
    where: {
      guardianId: guardianProfile.id,
      studentId: {
        in: [studentMaria.id, studentDiego.id],
      },
    },
  });

  await prisma.studentGuardian.createMany({
    data: [
      {
        studentId: studentMaria.id,
        guardianId: guardianProfile.id,
        relationship: "mother",
        isPrimary: true,
      },
      {
        studentId: studentDiego.id,
        guardianId: guardianProfile.id,
        relationship: "guardian",
        isPrimary: true,
      },
    ],
  });

  await prisma.schedule.upsert({
    where: {
      id: "55555555-5555-4555-8555-555555555555",
    },
    update: {
      tenantId: tenant.id,
      groupId: group5A.id,
      subjectId: mathSubject.id,
      teacherId: teacherProfile.id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:30",
      room: "Aula 201",
    },
    create: {
      id: "55555555-5555-4555-8555-555555555555",
      tenantId: tenant.id,
      groupId: group5A.id,
      subjectId: mathSubject.id,
      teacherId: teacherProfile.id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:30",
      room: "Aula 201",
    },
  });

  await prisma.schedule.upsert({
    where: {
      id: "66666666-6666-4666-8666-666666666666",
    },
    update: {
      tenantId: tenant.id,
      groupId: group6B.id,
      subjectId: spanishSubject.id,
      teacherId: teacherProfile.id,
      dayOfWeek: 2,
      startTime: "09:45",
      endTime: "11:15",
      room: "Aula 305",
    },
    create: {
      id: "66666666-6666-4666-8666-666666666666",
      tenantId: tenant.id,
      groupId: group6B.id,
      subjectId: spanishSubject.id,
      teacherId: teacherProfile.id,
      dayOfWeek: 2,
      startTime: "09:45",
      endTime: "11:15",
      room: "Aula 305",
    },
  });

  // ── Configuración académica por defecto (Colombia) ──────────────────────────
  const academicYear = await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "2026" } },
    update: { isActive: true },
    create: {
      tenantId: tenant.id,
      name: "2026",
      startDate: new Date("2026-01-27"),
      endDate: new Date("2026-11-27"),
      isActive: true,
    },
  });

  // 4 periodos iguales (25% c/u), como en Colombia. Configurable después vía API.
  for (let i = 1; i <= 4; i++) {
    await prisma.academicPeriod.upsert({
      where: { academicYearId_sequence: { academicYearId: academicYear.id, sequence: i } },
      update: { weight: 25 },
      create: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        name: `Periodo ${i}`,
        sequence: i,
        weight: 25,
      },
    });
  }

  // Escala nacional 1.0–5.0 (aprueba 3.0) con bandas cualitativas. Genérica: el
  // modelo soporta cualquier escala; esta es solo la semilla por defecto.
  const existingScale = await prisma.gradingScale.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
    select: { id: true },
  });
  if (!existingScale) {
    await prisma.gradingScale.create({
      data: {
        tenantId: tenant.id,
        name: "Escala nacional (1.0–5.0)",
        minValue: 1,
        maxValue: 5,
        passingValue: 3,
        isDefault: true,
        bands: {
          create: [
            { label: "Bajo", minValue: 1.0, maxValue: 2.99, order: 0 },
            { label: "Básico", minValue: 3.0, maxValue: 3.99, order: 1 },
            { label: "Alto", minValue: 4.0, maxValue: 4.59, order: 2 },
            { label: "Superior", minValue: 4.6, maxValue: 5.0, order: 3 },
          ],
        },
      },
    });
  }

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
