import { randomBytes, randomUUID } from "node:crypto";
import {
  PrismaClient,
  TenantStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const testPassword = "ClassiaTest2026!";

const firstNames = ["Sofia", "Mateo", "Valentina", "Santiago", "Isabella", "Matias", "Camila", "Sebastian", "Mariana", "Alejandro", "Valeria", "Diego", "Emma", "Nicolas", "Luciana", "Samuel", "Victoria", "Daniel", "Martina", "Joaquin", "Elena", "Tomas", "Antonella", "Gabriel", "Samantha", "Emiliano", "Mia", "Benjamin", "Renata", "Lucas"];
const lastNames = ["Gomez", "Rodriguez", "Gonzalez", "Fernandez", "Lopez", "Diaz", "Martinez", "Perez", "Garcia", "Sanchez", "Romero", "Sosa", "Alvarez", "Torres", "Ruiz", "Ramirez", "Flores", "Acosta", "Benitez", "Medina", "Suarez", "Herrera", "Aguirre", "Pereyra", "Gutierrez", "Gimenez", "Molina", "Silva", "Castro", "Rojas"];

function randomName() {
  return firstNames[Math.floor(Math.random() * firstNames.length)];
}

function randomLastName() {
  return `${lastNames[Math.floor(Math.random() * lastNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

async function seedTenant(tenantOptions: { slug: string, name: string, studentCount: number, passwordHash: string }) {
  console.log(`\n================================`);
  console.log(`Seeding tenant: ${tenantOptions.name} (${tenantOptions.slug})`);
  console.log(`================================`);
  
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantOptions.slug },
    update: {
      name: tenantOptions.name,
      primaryDomain: `${tenantOptions.slug}.classia.com.co`,
      status: TenantStatus.ACTIVE,
      brandColor: "#10b981", // emerald
    },
    create: {
      name: tenantOptions.name,
      slug: tenantOptions.slug,
      primaryDomain: `${tenantOptions.slug}.classia.com.co`,
      status: TenantStatus.ACTIVE,
      brandColor: "#10b981",
    },
  });

  const adminEmail = `admin@${tenantOptions.slug}.classia.co`;
  const tenantAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { firstName: "Admin", lastName: tenantOptions.name, status: UserStatus.ACTIVE, passwordHash: tenantOptions.passwordHash },
    create: { email: adminEmail, passwordHash: tenantOptions.passwordHash, firstName: "Admin", lastName: tenantOptions.name, status: UserStatus.ACTIVE },
  });

  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: tenantAdmin.id } },
    update: { role: UserRole.TENANT_ADMIN },
    create: { tenantId: tenant.id, userId: tenantAdmin.id, role: UserRole.TENANT_ADMIN },
  });

  // Create academic year 2026
  const academicYear = await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "2026" } },
    update: { isActive: true, status: "OPEN" },
    create: {
      tenantId: tenant.id,
      name: "2026",
      startDate: new Date("2026-01-27"),
      endDate: new Date("2026-11-27"),
      isActive: true,
      status: "OPEN"
    },
  });

  // Create periods
  const periods = [];
  for (let i = 1; i <= 4; i++) {
    periods.push(
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
      })
    );
  }

  // Create Scale
  let scale = await prisma.gradingScale.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });
  if (!scale) {
    scale = await prisma.gradingScale.create({
      data: {
        tenantId: tenant.id,
        name: "Escala nacional (1.0-5.0)",
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

  // Create Subjects
  const subjectsData = [
    { name: "Matemáticas", code: "MAT" },
    { name: "Español", code: "ESP" },
    { name: "Ciencias", code: "CIE" },
    { name: "Historia", code: "HIS" },
    { name: "Inglés", code: "ING" }
  ];
  
  for (const s of subjectsData) {
    const exists = await prisma.subject.findFirst({ where: { tenantId: tenant.id, code: s.code } });
    if (!exists) {
      await prisma.subject.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          code: s.code
        }
      });
    }
  }

  const actualSubjects = await prisma.subject.findMany({ where: { tenantId: tenant.id } });

  // Groups (Grades 1 to 5, A and B)
  const groupNames = ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", "5A", "5B"];
  const groups = [];
  for (const gn of groupNames) {
    let group = await prisma.group.findFirst({ where: { tenantId: tenant.id, name: gn } });
    if (!group) {
      group = await prisma.group.create({
        data: {
          tenantId: tenant.id,
          name: gn,
          grade: gn.charAt(0) + " Grado",
          section: gn.charAt(1)
        }
      });
    }
    groups.push(group);
  }

  // Teachers (10 teachers)
  const teachers = [];
  for (let i = 1; i <= 10; i++) {
    const fn = randomName();
    const ln = randomLastName();
    const email = `profesor${i}@${tenantOptions.slug}.classia.co`;
    
    let teacherUser = await prisma.user.findUnique({ where: { email } });
    if (!teacherUser) {
      teacherUser = await prisma.user.create({
        data: { email, passwordHash: tenantOptions.passwordHash, firstName: fn, lastName: ln, status: UserStatus.ACTIVE }
      });
    }
    
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: teacherUser.id } },
      update: { role: UserRole.TEACHER },
      create: { tenantId: tenant.id, userId: teacherUser.id, role: UserRole.TEACHER },
    });

    let teacher = await prisma.teacher.findUnique({ where: { userId: teacherUser.id } });
    if (!teacher) {
      teacher = await prisma.teacher.create({
        data: { userId: teacherUser.id, tenantId: tenant.id }
      });
    }
    teachers.push(teacher);
  }

  // Guardians (approx 80% of student count to force siblings)
  const guardianCount = Math.floor(tenantOptions.studentCount * 0.8);
  const guardians = [];
  for (let i = 1; i <= guardianCount; i++) {
    const fn = randomName();
    const ln = randomLastName();
    const email = `padre${i}@${tenantOptions.slug}.classia.co`;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, passwordHash: tenantOptions.passwordHash, firstName: fn, lastName: ln, status: UserStatus.ACTIVE }
      });
    }
    
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: { role: UserRole.GUARDIAN },
      create: { tenantId: tenant.id, userId: user.id, role: UserRole.GUARDIAN },
    });

    let guardian = await prisma.guardian.findUnique({ where: { userId: user.id } });
    if (!guardian) {
      guardian = await prisma.guardian.create({
        data: { userId: user.id, tenantId: tenant.id }
      });
    }
    guardians.push(guardian);
  }

  // Students
  // current students in this tenant
  const currentStudents = await prisma.student.count({ where: { tenantId: tenant.id } });
  const studentsToCreate = Math.max(0, tenantOptions.studentCount - currentStudents);
  
  console.log(`Creating ${studentsToCreate} students for ${tenantOptions.name}...`);
  
  const createdStudents = [];
  for (let i = 0; i < studentsToCreate; i++) {
    const fn = randomName();
    const ln = randomLastName();
    // 50% chance to have a user (some students don't have login)
    const hasUser = Math.random() > 0.5;
    let studentUser = null;
    if (hasUser) {
      const email = `estudiante${currentStudents + i + 1}@${tenantOptions.slug}.classia.co`;
      studentUser = await prisma.user.findUnique({ where: { email } });
      if (!studentUser) {
        studentUser = await prisma.user.create({
          data: { email, passwordHash: tenantOptions.passwordHash, firstName: fn, lastName: ln, status: UserStatus.ACTIVE }
        });
        await prisma.tenantMembership.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: studentUser.id } },
          update: { role: UserRole.STUDENT },
          create: { tenantId: tenant.id, userId: studentUser.id, role: UserRole.STUDENT },
        });
      }
    }

    const group = groups[Math.floor(Math.random() * groups.length)];
    const docId = `${tenantOptions.slug.toUpperCase()}-STU-${currentStudents + i + 1}`;

    const student = await prisma.student.upsert({
      where: { tenantId_documentId: { tenantId: tenant.id, documentId: docId } },
      update: { groupId: group.id, userId: studentUser?.id },
      create: {
        tenantId: tenant.id,
        firstName: fn,
        lastName: ln,
        documentId: docId,
        birthDate: new Date(`201${Math.floor(Math.random() * 5) + 0}-01-01`),
        groupId: group.id,
        userId: studentUser?.id,
        isActive: true
      }
    });
    createdStudents.push(student);

    // Assign Guardian
    const guardian = guardians[Math.floor(Math.random() * guardians.length)];
    await prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: {
          studentId: student.id,
          guardianId: guardian.id
        }
      },
      update: {},
      create: {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: "parent",
        isPrimary: true
      }
    });
  }

  // Create schedules, homeworks, categories, marks
  console.log(`Creating academic records (categories, marks) for ${tenantOptions.name}...`);
  // Just to avoid infinite loops and taking forever, let's create a few marks per student per subject
  const allStudents = await prisma.student.findMany({ where: { tenantId: tenant.id } });
  
  for (const group of groups) {
    const groupStudents = allStudents.filter(s => s.groupId === group.id);
    if (groupStudents.length === 0) continue;

    for (const subject of actualSubjects) {
      // Assign a teacher to this group+subject
      const teacher = teachers[Math.floor(Math.random() * teachers.length)];
      
      // create schedule
      await prisma.schedule.create({
        data: {
          tenantId: tenant.id,
          groupId: group.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          dayOfWeek: Math.floor(Math.random() * 5) + 1,
          startTime: "08:00",
          endTime: "10:00"
        }
      });

      // create Category for Period 1
      const category = await prisma.gradingCategory.create({
        data: {
          tenantId: tenant.id,
          groupId: group.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          periodId: periods[0].id, // First Period
          name: "Actividades de Clase P1",
          weight: 100
        }
      });

      // create 2 marks for Period 1 for each student
      for (let markIndex = 1; markIndex <= 2; markIndex++) {
        const homework = await prisma.homework.create({
          data: {
            tenantId: tenant.id,
            teacherId: teacher.id,
            subjectId: subject.id,
            groupId: group.id,
            academicYearId: academicYear.id,
            title: `Actividad ${markIndex} - P1 - ${subject.name}`,
            dueDate: new Date(),
            weight: 50
          }
        });

        const marksData = groupStudents.map(student => {
          const val = Math.round((Math.random() * 4 + 1) * 10) / 10; // 1.0 to 5.0
          return {
            tenantId: tenant.id,
            studentId: student.id,
            subjectId: subject.id,
            teacherId: teacher.id,
            homeworkId: homework.id,
            categoryId: category.id,
            academicYearId: academicYear.id,
            title: homework.title,
            value: val,
            maxValue: 5,
            period: 1,
            isPublished: true
          };
        });

        await prisma.mark.createMany({ data: marksData });
      }
    }
  }

  console.log(`Tenant ${tenantOptions.name} seeded successfully.`);
}

async function main() {
  console.log("Starting massive seed...");
  const passwordHash = await bcrypt.hash(testPassword, 12);

  // 1. Current Demo Tenant (needs 98 more students to reach ~100)
  await seedTenant({
    slug: "demo",
    name: "Colegio Demo Classia",
    studentCount: 100,
    passwordHash
  });

  // 2. New Tenants (5)
  const newTenants = [
    { slug: "horizonte", name: "Colegio Horizonte" },
    { slug: "sanjorge", name: "Instituto San Jorge" },
    { slug: "montessori", name: "Liceo Montessori" },
    { slug: "andes", name: "Gimnasio Los Andes" },
    { slug: "valle", name: "Colegio Del Valle" },
  ];

  for (const t of newTenants) {
    await seedTenant({
      slug: t.slug,
      name: t.name,
      studentCount: 100,
      passwordHash
    });
  }

  console.log("\nMassive seed completed successfully!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
