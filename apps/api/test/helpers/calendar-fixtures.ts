// Fixtures compartidos por las suites e2e del calendario (events y calendar-feed).
//
// Viven acá y no dentro de un spec porque los dos necesitan exactamente el mismo escenario:
// un colegio con dos grupos, dos profesores que enseñan uno cada uno, un acudiente con su
// hijo en el grupo uno, y un segundo colegio con un evento propio para probar aislamiento.
// Duplicarlo era ~150 líneas repetidas que se desincronizan al primer cambio de modelo.
//
// Todo lo que toca tablas con RLS forzado corre dentro de runWithTenant: sin contexto de
// tenant esas escrituras no fallan, escriben cero filas.
import { TenantStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../src/core/prisma/prisma.service";
import { TenantRlsContextService } from "../../src/core/prisma/tenant-rls-context.service";

export const PASSWORD = "ClassiaDemo2026!";
export const TENANT_A_SLUG = "demo";
export const TENANT_B_SLUG = "events-e2e-tenant-b";

export const ADMIN_A_EMAIL = "events-e2e-admin-a@classia.test";
export const TEACHER_1_EMAIL = "events-e2e-teacher-1@classia.test";
export const TEACHER_2_EMAIL = "events-e2e-teacher-2@classia.test";
export const GUARDIAN_EMAIL = "events-e2e-guardian@classia.test";
export const ADMIN_B_EMAIL = "events-e2e-admin-b@classia.test";

export type Fixtures = {
  tenantAId: string;
  tenantBId: string;
  /** Grupo del profesor 1 y del estudiante del acudiente. */
  groupOneId: string;
  /** Grupo del profesor 2 — el que el profesor 1 NO debe poder tocar. */
  groupTwoId: string;
  teacher1UserId: string;
  /** Fila Teacher (no User) del profesor 1 — la que referencia Homework. */
  teacher1Id: string;
  subjectId: string;
  /** Horario del profesor 1 en el grupo uno — para abrir sesiones de asistencia. */
  scheduleOneId: string;
  tenantBEventId: string;
};

export async function ensureFixtures(
  prisma: PrismaService,
  tenantRlsContext: TenantRlsContextService,
): Promise<Fixtures> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const tenantA = await prisma.tenant.upsert({
    where: { slug: TENANT_A_SLUG },
    update: {},
    create: {
      slug: TENANT_A_SLUG,
      name: "Colegio Demo Classia",
      status: TenantStatus.DEMO,
      // El resto de la suite asume Bogotá; el test de allDay depende de esta zona.
      timezone: "America/Bogota",
    },
  });

  const tenantB = await prisma.tenant.upsert({
    where: { slug: TENANT_B_SLUG },
    update: { status: TenantStatus.ACTIVE },
    create: { slug: TENANT_B_SLUG, name: "Events E2E Tenant B", status: TenantStatus.ACTIVE },
  });

  const upsertUser = (email: string, firstName: string) =>
    prisma.user.upsert({
      where: { email },
      update: { status: UserStatus.ACTIVE, passwordHash },
      create: {
        email,
        passwordHash,
        firstName,
        lastName: "Events E2E",
        status: UserStatus.ACTIVE,
      },
    });

  const adminAUser = await upsertUser(ADMIN_A_EMAIL, "Rector A");
  const teacher1User = await upsertUser(TEACHER_1_EMAIL, "Profesor Uno");
  const teacher2User = await upsertUser(TEACHER_2_EMAIL, "Profesor Dos");
  const guardianUser = await upsertUser(GUARDIAN_EMAIL, "Acudiente");
  const adminBUser = await upsertUser(ADMIN_B_EMAIL, "Rector B");

  // Todo lo de acá para abajo toca tablas con RLS forzado, así que va dentro de
  // runWithTenant: sin contexto de tenant estas escrituras no fallan, escriben cero filas.
  const scoped = await tenantRlsContext.runWithTenant(tenantA.id, async () => {
    for (const [user, role] of [
      [adminAUser, UserRole.TENANT_ADMIN],
      [teacher1User, UserRole.TEACHER],
      [teacher2User, UserRole.TEACHER],
      [guardianUser, UserRole.GUARDIAN],
    ] as const) {
      await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
        update: { role, status: "ACTIVE" },
        create: { tenantId: tenantA.id, userId: user.id, role },
      });
    }

    const groupOne = await upsertGroup(prisma, tenantA.id, "EVENTS-E2E-1", "1");
    const groupTwo = await upsertGroup(prisma, tenantA.id, "EVENTS-E2E-2", "2");

    const subject = await upsertSubject(prisma, tenantA.id, "EVENTS-E2E-MAT");

    const teacher1 = await prisma.teacher.upsert({
      where: { userId: teacher1User.id },
      update: { tenantId: tenantA.id },
      create: { userId: teacher1User.id, tenantId: tenantA.id },
    });
    const teacher2 = await prisma.teacher.upsert({
      where: { userId: teacher2User.id },
      update: { tenantId: tenantA.id },
      create: { userId: teacher2User.id, tenantId: tenantA.id },
    });

    // El grupo de un profesor se deriva de sus Schedule (AudienceScopeService), así que sin
    // horario el profesor no tiene grupos y todos los tests de alcance darían 403 por la
    // razón equivocada.
    const scheduleOne = await upsertSchedule(prisma, tenantA.id, groupOne.id, subject.id, teacher1.id, 1);
    await upsertSchedule(prisma, tenantA.id, groupTwo.id, subject.id, teacher2.id, 2);

    const guardian = await prisma.guardian.upsert({
      where: { userId: guardianUser.id },
      update: { tenantId: tenantA.id },
      create: { userId: guardianUser.id, tenantId: tenantA.id },
    });

    const student = await prisma.student.upsert({
      where: { tenantId_documentId: { tenantId: tenantA.id, documentId: "EVENTS-E2E-STU-1" } },
      update: { groupId: groupOne.id },
      create: {
        tenantId: tenantA.id,
        documentId: "EVENTS-E2E-STU-1",
        firstName: "Estudiante",
        lastName: "Events E2E",
        groupId: groupOne.id,
      },
    });

    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
      update: {},
      create: { studentId: student.id, guardianId: guardian.id, tenantId: tenantA.id },
    });

    return {
      groupOneId: groupOne.id,
      groupTwoId: groupTwo.id,
      scheduleOneId: scheduleOne.id,
      teacher1Id: teacher1.id,
      subjectId: subject.id,
    };
  });

  const tenantBEventId = await tenantRlsContext.runWithTenant(tenantB.id, async () => {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenantB.id, userId: adminBUser.id } },
      update: { role: UserRole.TENANT_ADMIN, status: "ACTIVE" },
      create: { tenantId: tenantB.id, userId: adminBUser.id, role: UserRole.TENANT_ADMIN },
    });

    const existing = await prisma.event.findFirst({
      where: { tenantId: tenantB.id, title: "Evento privado del colegio B" },
      select: { id: true },
    });
    if (existing) {
      // Un test anterior pudo haberlo dejado soft-deleted; se reabre para que el aislamiento
      // se pruebe contra una fila viva.
      await prisma.event.update({ where: { id: existing.id }, data: { deletedAt: null } });
      return existing.id;
    }

    const created = await prisma.event.create({
      data: {
        tenantId: tenantB.id,
        title: "Evento privado del colegio B",
        type: CalendarEventType.REUNION,
        startsAt: new Date("2026-05-20T14:00:00.000Z"),
        endsAt: new Date("2026-05-20T16:00:00.000Z"),
        createdById: adminBUser.id,
      },
      select: { id: true },
    });
    return created.id;
  });

  return {
    tenantAId: tenantA.id,
    tenantBId: tenantB.id,
    groupOneId: scoped.groupOneId,
    groupTwoId: scoped.groupTwoId,
    teacher1UserId: teacher1User.id,
    teacher1Id: scoped.teacher1Id,
    subjectId: scoped.subjectId,
    scheduleOneId: scoped.scheduleOneId,
    tenantBEventId,
  };
}

async function upsertGroup(prisma: PrismaService, tenantId: string, name: string, section: string) {
  const existing = await prisma.group.findFirst({ where: { tenantId, name }, select: { id: true } });
  if (existing) return existing;
  return prisma.group.create({
    data: { tenantId, name, grade: "5", section },
    select: { id: true },
  });
}

async function upsertSubject(prisma: PrismaService, tenantId: string, name: string) {
  const existing = await prisma.subject.findFirst({
    where: { tenantId, name },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.subject.create({ data: { tenantId, name }, select: { id: true } });
}

async function upsertSchedule(
  prisma: PrismaService,
  tenantId: string,
  groupId: string,
  subjectId: string,
  teacherId: string,
  dayOfWeek: number,
) {
  const existing = await prisma.schedule.findFirst({
    where: { tenantId, groupId, teacherId },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.schedule.create({
    data: {
      tenantId,
      groupId,
      subjectId,
      teacherId,
      dayOfWeek,
      startTime: "07:00",
      endTime: "08:00",
    },
    select: { id: true },
  });
}
