import { randomBytes } from "node:crypto";
import {
  AccessScope,
  AccessSessionStatus,
  CalendarEventType,
  PrismaClient,
  TenantStatus,
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { colombianHolidays } from "../src/colombia-holidays";

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

  // ── Equipo de soporte B2B ────────────────────────────────────────────────
  // Supervisor: asigna tickets y otorga acceso a un colegio, sin el resto
  // del poder de plataforma que tiene SUPER_ADMIN. Agentes: trabajan los
  // tickets que el supervisor les asigna.
  const supportSupervisor = await prisma.user.upsert({
    where: { email: "supervisor.soporte@classia.com.co" },
    update: { firstName: "Camila", lastName: "Rodríguez", status: UserStatus.ACTIVE, passwordHash },
    create: {
      email: "supervisor.soporte@classia.com.co",
      passwordHash,
      firstName: "Camila",
      lastName: "Rodríguez",
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: supportSupervisor.id } },
    update: { role: UserRole.SUPPORT_SUPERVISOR },
    create: { tenantId: tenant.id, userId: supportSupervisor.id, role: UserRole.SUPPORT_SUPERVISOR },
  });

  const supportAgents = [
    { email: "agente1.soporte@classia.com.co", firstName: "Daniel", lastName: "Torres" },
    { email: "agente2.soporte@classia.com.co", firstName: "Valentina", lastName: "Ramírez" },
  ];
  for (const agent of supportAgents) {
    const agentUser = await prisma.user.upsert({
      where: { email: agent.email },
      update: { firstName: agent.firstName, lastName: agent.lastName, status: UserStatus.ACTIVE, passwordHash },
      create: {
        email: agent.email,
        passwordHash,
        firstName: agent.firstName,
        lastName: agent.lastName,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: agentUser.id } },
      update: { role: UserRole.SUPPORT_AGENT },
      create: { tenantId: tenant.id, userId: agentUser.id, role: UserRole.SUPPORT_AGENT },
    });
  }

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
        tenantId: tenant.id,
        studentId: studentMaria.id,
        guardianId: guardianProfile.id,
        relationship: "mother",
        isPrimary: true,
      },
      {
        tenantId: tenant.id,
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
            { tenantId: tenant.id, label: "Bajo", minValue: 1.0, maxValue: 2.99, order: 0 },
            { tenantId: tenant.id, label: "Básico", minValue: 3.0, maxValue: 3.99, order: 1 },
            { tenantId: tenant.id, label: "Alto", minValue: 4.0, maxValue: 4.59, order: 2 },
            { tenantId: tenant.id, label: "Superior", minValue: 4.6, maxValue: 5.0, order: 3 },
          ],
        },
      },
    });
  }

  // ── Año histórico 2025 (archivado) con notas y boletines FINAL ─────────────
  // Data de demostración para el histórico multi-año: notas por periodo y
  // boletines congelados. Idempotente: se borra y regenera en cada seed.
  const year2025 = await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "2025" } },
    update: { status: "ARCHIVED", isActive: false },
    create: {
      tenantId: tenant.id,
      name: "2025",
      startDate: new Date("2025-01-27"),
      endDate: new Date("2025-11-28"),
      status: "ARCHIVED",
      isActive: false,
    },
  });

  const periods2025 = [];
  for (let i = 1; i <= 4; i++) {
    periods2025.push(
      await prisma.academicPeriod.upsert({
        where: { academicYearId_sequence: { academicYearId: year2025.id, sequence: i } },
        update: { weight: 25 },
        create: {
          tenantId: tenant.id,
          academicYearId: year2025.id,
          name: `Periodo ${i}`,
          sequence: i,
          weight: 25,
        },
      }),
    );
  }

  // Definitivas por periodo (escala 1-5): María va bien, Diego remonta el año.
  const history2025: { student: { id: string }; subject: { id: string; name: string }; finals: number[] }[] = [
    { student: studentMaria, subject: mathSubject, finals: [4.2, 4.6, 4.4, 4.8] },
    { student: studentMaria, subject: spanishSubject, finals: [3.8, 4.0, 4.2, 4.4] },
    { student: studentDiego, subject: mathSubject, finals: [2.8, 3.2, 3.0, 3.4] },
    { student: studentDiego, subject: spanishSubject, finals: [3.6, 3.4, 3.8, 4.0] },
  ];

  await prisma.reportCard.deleteMany({ where: { academicYearId: year2025.id } });
  await prisma.mark.deleteMany({ where: { academicYearId: year2025.id } });

  const bandFor = (v: number) => (v < 3 ? "Bajo" : v < 4 ? "Básico" : v < 4.6 ? "Alto" : "Superior");
  const round1 = (v: number) => Math.round(v * 100) / 100;

  for (const row of history2025) {
    for (let p = 0; p < 4; p++) {
      // Dos notas por periodo cuyo promedio da la definitiva elegida.
      const final = row.finals[p];
      for (const [j, value] of [round1(final - 0.2), round1(final + 0.2)].entries()) {
        await prisma.mark.create({
          data: {
            tenantId: tenant.id,
            studentId: row.student.id,
            subjectId: row.subject.id,
            teacherId: teacherProfile.id,
            academicYearId: year2025.id,
            title: `${row.subject.name} · Evaluación ${j + 1} P${p + 1} 2025`,
            value: Math.min(5, Math.max(1, value)),
            maxValue: 5,
            period: p + 1,
            date: new Date(`2025-0${2 + p * 2}-15`),
            isPublished: true,
          },
        });
      }
    }
  }

  const students2025 = [studentMaria, studentDiego];
  for (const student of students2025) {
    const rows = history2025.filter((r) => r.student.id === student.id);
    // Boletines FINAL por periodo.
    for (let p = 0; p < 4; p++) {
      const lines = rows.map((r) => ({
        tenantId: tenant.id,
        subjectId: r.subject.id,
        subjectName: r.subject.name,
        final: r.finals[p],
        label: bandFor(r.finals[p]),
        passing: r.finals[p] >= 3,
      }));
      await prisma.reportCard.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          academicYearId: year2025.id,
          periodId: periods2025[p].id,
          status: "FINAL",
          overallAverage: round1(lines.reduce((s, l) => s + l.final, 0) / lines.length),
          scaleName: "Escala nacional (1.0–5.0)",
          generatedById: tenantAdmin.id,
          generatedAt: new Date(`2025-0${3 + p * 2}-01`),
          lines: { create: lines },
        },
      });
    }
    // Boletín FINAL del año (promedio de los 4 periodos por materia).
    const yearLines = rows.map((r) => {
      const final = round1(r.finals.reduce((s, v) => s + v, 0) / r.finals.length);
      return {
        tenantId: tenant.id,
        subjectId: r.subject.id,
        subjectName: r.subject.name,
        final,
        label: bandFor(final),
        passing: final >= 3,
      };
    });
    await prisma.reportCard.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        academicYearId: year2025.id,
        periodId: null,
        status: "FINAL",
        overallAverage: round1(yearLines.reduce((s, l) => s + l.final, 0) / yearLines.length),
        scaleName: "Escala nacional (1.0–5.0)",
        generatedById: tenantAdmin.id,
        generatedAt: new Date("2025-12-01"),
        lines: { create: yearLines },
      },
    });
  }

  // ── Calendario ──────────────────────────────────────────────────────────────
  //
  // Dos bloques: los festivos nacionales (§9.4 del plan: se precargan, editables por el
  // colegio) y eventos propios de un calendario escolar colombiano.
  //
  // Las fechas se guardan en UTC. Los eventos de todo el día van de 00:00 a 23:59:59.999
  // en hora de Bogotá (UTC-5), que es lo mismo que hace EventsService al normalizar: un
  // festivo guardado a medianoche UTC se ve el día anterior en Colombia.
  const BOGOTA_OFFSET_HOURS = 5;
  const bogotaWallTime = (year: number, month: number, day: number, hour = 0, minute = 0) =>
    new Date(Date.UTC(year, month - 1, day, hour + BOGOTA_OFFSET_HOURS, minute));
  const endOfBogotaDay = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month - 1, day, 23 + BOGOTA_OFFSET_HOURS, 59, 59, 999));

  // Idempotencia: se borran los eventos del seed y se recrean. No se puede usar la fecha
  // como clave (dos festivos pueden caer el mismo lunes, ver colombianHolidays) ni el
  // título (el colegio puede renombrarlos), así que el criterio es "los que sembró el seed",
  // identificados por haber sido creados por el rector demo.
  await prisma.event.deleteMany({ where: { tenantId: tenant.id, createdById: tenantAdmin.id } });

  const holidayEvents = colombianHolidays(2026).map((holiday) => ({
    tenantId: tenant.id,
    title: holiday.moved ? `${holiday.name} (trasladado)` : holiday.name,
    description: "Festivo nacional. Editable por el colegio.",
    type: CalendarEventType.FESTIVO,
    startsAt: bogotaWallTime(holiday.year, holiday.month, holiday.day),
    endsAt: endOfBogotaDay(holiday.year, holiday.month, holiday.day),
    allDay: true,
    isSchoolDayOff: true,
    createdById: tenantAdmin.id,
  }));

  const schoolEvents = [
    {
      title: "Inicio del año escolar 2026",
      description: "Primer día de clases. Jornada de bienvenida por grupos.",
      type: CalendarEventType.ACADEMICO,
      startsAt: bogotaWallTime(2026, 1, 27, 7, 0),
      endsAt: bogotaWallTime(2026, 1, 27, 13, 0),
      location: "Todas las sedes",
    },
    {
      title: "Asamblea general de padres de familia",
      description: "Presentación del plan académico y elección de representantes de curso.",
      type: CalendarEventType.REUNION,
      startsAt: bogotaWallTime(2026, 2, 6, 18, 0),
      endsAt: bogotaWallTime(2026, 2, 6, 20, 0),
      location: "Auditorio principal",
      targetRole: UserRole.GUARDIAN,
      reminderMinutesBefore: 24 * 60,
    },
    {
      title: "Cierre de notas — Periodo 1",
      description: "Último día para registrar calificaciones del primer periodo.",
      type: CalendarEventType.ACADEMICO,
      startsAt: bogotaWallTime(2026, 4, 10, 23, 0),
      endsAt: bogotaWallTime(2026, 4, 10, 23, 59),
      targetRole: UserRole.TEACHER,
      reminderMinutesBefore: 3 * 24 * 60,
    },
    {
      title: "Entrega de boletines — Periodo 1",
      description: "Atención a acudientes por director de grupo, cita previa.",
      type: CalendarEventType.REUNION,
      startsAt: bogotaWallTime(2026, 4, 17, 7, 0),
      endsAt: bogotaWallTime(2026, 4, 17, 12, 0),
      location: "Salones de clase",
      targetRole: UserRole.GUARDIAN,
      reminderMinutesBefore: 24 * 60,
    },
    {
      title: "Simulacro nacional de evacuación",
      type: CalendarEventType.ADMINISTRATIVO,
      startsAt: bogotaWallTime(2026, 5, 6, 10, 0),
      endsAt: bogotaWallTime(2026, 5, 6, 11, 0),
      location: "Patio central",
    },
    {
      title: "Semana de desarrollo institucional",
      description: "Sin clases. Jornada pedagógica para docentes.",
      type: CalendarEventType.INSTITUCIONAL,
      startsAt: bogotaWallTime(2026, 6, 22),
      endsAt: endOfBogotaDay(2026, 6, 26),
      allDay: true,
      isSchoolDayOff: true,
    },
    {
      title: "Elección de personero estudiantil",
      description: "Jornada de votación en la sala de sistemas por franjas horarias.",
      type: CalendarEventType.INSTITUCIONAL,
      startsAt: bogotaWallTime(2026, 3, 13, 8, 0),
      endsAt: bogotaWallTime(2026, 3, 13, 15, 0),
      location: "Sala de sistemas",
      targetRole: UserRole.STUDENT,
    },
    {
      title: "Izada de bandera — 20 de julio",
      type: CalendarEventType.INSTITUCIONAL,
      startsAt: bogotaWallTime(2026, 7, 17, 7, 30),
      endsAt: bogotaWallTime(2026, 7, 17, 9, 0),
      location: "Patio central",
    },
    {
      title: "Festival cultural y deportivo",
      type: CalendarEventType.INSTITUCIONAL,
      startsAt: bogotaWallTime(2026, 9, 25, 8, 0),
      endsAt: bogotaWallTime(2026, 9, 25, 16, 0),
      location: "Coliseo",
    },
    {
      title: "Refuerzo de matemáticas — 5A",
      description: "Repaso de fracciones antes de la evaluación acumulativa.",
      type: CalendarEventType.ACADEMICO,
      startsAt: bogotaWallTime(2026, 4, 8, 14, 0),
      endsAt: bogotaWallTime(2026, 4, 8, 15, 30),
      location: "Aula 201",
      // Evento de un solo grupo: es exactamente lo que un profesor puede crear (§9.2).
      groupId: group5A.id,
    },
    {
      title: "Salida pedagógica — Museo del Oro (6B)",
      type: CalendarEventType.ACADEMICO,
      startsAt: bogotaWallTime(2026, 8, 20, 7, 0),
      endsAt: bogotaWallTime(2026, 8, 20, 14, 0),
      location: "Museo del Oro, Bogotá",
      groupId: group6B.id,
      reminderMinutesBefore: 2 * 24 * 60,
    },
    {
      title: "Matrículas 2027 — estudiantes antiguos",
      type: CalendarEventType.ADMINISTRATIVO,
      startsAt: bogotaWallTime(2026, 11, 16),
      endsAt: endOfBogotaDay(2026, 11, 20),
      allDay: true,
      location: "Secretaría académica",
      targetRole: UserRole.GUARDIAN,
    },
  ].map((event) => ({ ...event, tenantId: tenant.id, createdById: tenantAdmin.id }));

  await prisma.event.createMany({ data: [...holidayEvents, ...schoolEvents] });


  // ── Acceso de soporte listo para usar en local ───────────────────────────
  //
  // Desde el 2026-07-27 un SUPER_ADMIN no entra a un colegio por la puerta del frente
  // (JwtAuthGuard#assertPlatformScope): el único camino es la impersonación, que exige un
  // ticket de ese colegio y una AccessSession aprobada por un supervisor. Montar eso a mano
  // para cada prueba local son varios pasos y dos identidades distintas, así que el seed lo
  // deja hecho: se entra desde /superadmin/tenants con un clic y se recorre el flujo REAL
  // —franja ámbar, alcance, vencimiento, auditoría— en vez de una versión falsa de él.
  //
  // Vence en un año, no nunca. `expiresAt` nulo NO significa "eterna": DataScopeGuard filtra
  // por `expiresAt > ahora` y en SQL una comparación contra NULL no es verdadera, así que la
  // sesión se leería como inactiva mientras `resolveExpiration` la seguiría mostrando como
  // CONCEDIDA — viva en la lista y sin servir para nada. Un año es lo más cerca de "sin
  // caducidad" que se puede estar sin que el código de producción tenga que entender el
  // concepto de un acceso que no vence.
  //
  // El tope de 8 horas (MAX_ACCESS_DURATION_MINUTES) vive en el Zod del endpoint de
  // aprobación, no en la base: el seed escribe directo con Prisma, así que no lo cruza. Es
  // dato de demo y `seed:demo` no corre en producción.
  const soporteTicket = await prisma.supportTicket.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: { status: TicketStatus.IN_PROGRESS, assigneeId: supportSupervisor.id },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      tenantId: tenant.id,
      authorId: tenantAdmin.id,
      assigneeId: supportSupervisor.id,
      title: "Acceso de soporte para pruebas locales",
      description:
        "Ticket sembrado por seed:demo para poder entrar al colegio por impersonación en desarrollo. No representa una incidencia real.",
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      category: "soporte-tecnico",
    },
  });

  const accesoConcedidoDesde = new Date();
  const accesoExpiraEn = new Date(accesoConcedidoDesde.getTime() + 365 * 24 * 60 * 60 * 1000);

  await prisma.accessSession.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {
      // `scope` va también acá y no solo en `create`: si no, volver a sembrar con otro
      // alcance no cambiaba nada sobre una base que ya tenía la fila, y el seed mentía sobre
      // su propio estado declarado.
      scope: AccessScope.DATOS_PERSONALES,
      status: AccessSessionStatus.CONCEDIDO,
      grantedAt: accesoConcedidoDesde,
      expiresAt: accesoExpiraEn,
      revokedAt: null,
      revokedReason: null,
    },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      ticketId: soporteTicket.id,
      tenantId: tenant.id,
      requestedById: superAdmin.id,
      approvedById: supportSupervisor.id,
      // DATOS_PERSONALES y no OPERATIVO: es el alcance amplio, y cubre los dos: DataScopeGuard
      // solo exige que la sesión sea DATOS_PERSONALES cuando la ruta lo pide, así que con esta
      // se recorre el panel entero. Con OPERATIVO, media app respondería 403 en local y
      // parecería rota cuando en realidad sería el gate haciendo su trabajo. Para ejercitar
      // ese gate a propósito, cambiar acá a AccessScope.OPERATIVO y volver a sembrar: las
      // rutas de datos personales (estudiantes, notas) pasan a 403 y las operativas siguen.
      scope: AccessScope.DATOS_PERSONALES,
      status: AccessSessionStatus.CONCEDIDO,
      reason: "Acceso sembrado para desarrollo local (seed:demo).",
      requestedDurationMinutes: 240,
      grantedAt: accesoConcedidoDesde,
      expiresAt: accesoExpiraEn,
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
  console.log("Support team: supervisor.soporte@classia.com.co, agente1.soporte@classia.com.co, agente2.soporte@classia.com.co");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
