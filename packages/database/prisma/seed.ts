import { PrismaClient, UserRole, AttendanceStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding demo tenant...");

  // ── Tenant demo ──────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Colegio San Pedro Demo",
      slug: "demo",
      status: "DEMO",
      brandColor: "#1a56db",
      timezone: "America/Bogota",
    },
  });

  const pw = await hash("demo123", 10);

  // ── Usuarios ─────────────────────────────────────────────────────────────
  const adminUser = await upsertUser(tenant.id, "admin@demo.classia.co", pw, "Ana", "Rodríguez", "TENANT_ADMIN");
  const teacher1User = await upsertUser(tenant.id, "lopez@demo.classia.co", pw, "Juan", "López", "TEACHER");
  const teacher2User = await upsertUser(tenant.id, "martinez@demo.classia.co", pw, "Clara", "Martínez", "TEACHER");
  const guardianUser = await upsertUser(tenant.id, "rosa@demo.classia.co", pw, "Rosa", "García", "GUARDIAN");
  const guardian2User = await upsertUser(tenant.id, "carlos@demo.classia.co", pw, "Carlos", "Mendoza", "GUARDIAN");

  // ── Materias ──────────────────────────────────────────────────────────────
  const math = await upsertSubject(tenant.id, "Matemáticas", "MAT");
  const spanish = await upsertSubject(tenant.id, "Español", "ESP");
  const science = await upsertSubject(tenant.id, "Ciencias Naturales", "CIE");
  const history = await upsertSubject(tenant.id, "Historia", "HIS");
  const algebra = await upsertSubject(tenant.id, "Álgebra", "ALG");

  // ── Grupos ────────────────────────────────────────────────────────────────
  const group5A = await upsertGroup(tenant.id, "5to Grado A", "5", "A");
  const group5B = await upsertGroup(tenant.id, "5to Grado B", "5", "B");
  const group6A = await upsertGroup(tenant.id, "6to Grado A", "6", "A");
  const group6B = await upsertGroup(tenant.id, "6to Grado B", "6", "B");
  const group4A = await upsertGroup(tenant.id, "4to Grado A", "4", "A");

  // ── Profesores ────────────────────────────────────────────────────────────
  const teacher1 = await prisma.teacher.upsert({
    where: { userId: teacher1User.id },
    update: {},
    create: { userId: teacher1User.id, tenantId: tenant.id },
  });

  const teacher2 = await prisma.teacher.upsert({
    where: { userId: teacher2User.id },
    update: {},
    create: { userId: teacher2User.id, tenantId: tenant.id },
  });

  // ── Horarios ──────────────────────────────────────────────────────────────
  const schedules = [
    { groupId: group5A.id, subjectId: math.id, teacherId: teacher1.id, dayOfWeek: 1, startTime: "08:00", endTime: "09:30", room: "Aula 201" },
    { groupId: group6B.id, subjectId: math.id, teacherId: teacher1.id, dayOfWeek: 1, startTime: "09:45", endTime: "11:15", room: "Aula 305" },
    { groupId: group6A.id, subjectId: algebra.id, teacherId: teacher1.id, dayOfWeek: 1, startTime: "11:30", endTime: "13:00", room: "Aula 305" },
    { groupId: group4A.id, subjectId: math.id, teacherId: teacher1.id, dayOfWeek: 1, startTime: "14:00", endTime: "15:30", room: "Aula 102" },
    { groupId: group5A.id, subjectId: spanish.id, teacherId: teacher2.id, dayOfWeek: 2, startTime: "08:00", endTime: "09:30", room: "Aula 105" },
    { groupId: group5B.id, subjectId: science.id, teacherId: teacher2.id, dayOfWeek: 2, startTime: "09:45", endTime: "11:15", room: "Lab 1" },
  ];

  const createdSchedules: any[] = [];
  for (const s of schedules) {
    const existing = await prisma.schedule.findFirst({
      where: { tenantId: tenant.id, groupId: s.groupId, subjectId: s.subjectId, dayOfWeek: s.dayOfWeek },
    });
    if (!existing) {
      createdSchedules.push(await prisma.schedule.create({ data: { tenantId: tenant.id, ...s } }));
    } else {
      createdSchedules.push(existing);
    }
  }

  // ── Estudiantes ───────────────────────────────────────────────────────────
  const studentDefs = [
    { firstName: "María", lastName: "García López", groupId: group5A.id, documentId: "1001" },
    { firstName: "Pedro", lastName: "Hernández", groupId: group5A.id, documentId: "1002" },
    { firstName: "Sofía", lastName: "Torres", groupId: group5A.id, documentId: "1003" },
    { firstName: "Diego", lastName: "Mendoza", groupId: group5A.id, documentId: "1004" },
    { firstName: "Valentina", lastName: "Ramos", groupId: group6A.id, documentId: "1005" },
    { firstName: "Andrés", lastName: "Vargas", groupId: group6A.id, documentId: "1006" },
    { firstName: "Laura", lastName: "Castro", groupId: group6B.id, documentId: "1007" },
    { firstName: "Miguel", lastName: "Ortiz", groupId: group4A.id, documentId: "1008" },
  ];

  const students: any[] = [];
  for (const s of studentDefs) {
    const existing = await prisma.student.findFirst({ where: { tenantId: tenant.id, documentId: s.documentId } });
    if (!existing) {
      students.push(await prisma.student.create({ data: { tenantId: tenant.id, ...s } }));
    } else {
      students.push(existing);
    }
  }

  // ── Acudientes ────────────────────────────────────────────────────────────
  const guardian1 = await prisma.guardian.upsert({
    where: { userId: guardianUser.id },
    update: {},
    create: { userId: guardianUser.id, tenantId: tenant.id },
  });

  const guardian2 = await prisma.guardian.upsert({
    where: { userId: guardian2User.id },
    update: {},
    create: { userId: guardian2User.id, tenantId: tenant.id },
  });

  // Rosa García es acudiente de María García (students[0]) y Sofía Torres (students[2])
  for (const studentId of [students[0].id, students[2].id]) {
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId, guardianId: guardian1.id } },
      update: {},
      create: { studentId, guardianId: guardian1.id, relationship: "madre", isPrimary: true },
    });
  }

  // Carlos Mendoza es acudiente de Diego Mendoza (students[3])
  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: students[3].id, guardianId: guardian2.id } },
    update: {},
    create: { studentId: students[3].id, guardianId: guardian2.id, relationship: "padre", isPrimary: true },
  });

  // ── Calificaciones ────────────────────────────────────────────────────────
  const markDefs = [
    { studentId: students[0].id, subjectId: math.id, title: "Examen Parcial 2", value: 95 },
    { studentId: students[0].id, subjectId: spanish.id, title: "Ensayo Literario", value: 88 },
    { studentId: students[0].id, subjectId: science.id, title: "Proyecto Ecosistemas", value: 92 },
    { studentId: students[0].id, subjectId: history.id, title: "Cuestionario Cap. 5", value: 85 },
    { studentId: students[1].id, subjectId: math.id, title: "Examen Parcial 2", value: 78 },
    { studentId: students[1].id, subjectId: spanish.id, title: "Ensayo Literario", value: 82 },
    { studentId: students[2].id, subjectId: math.id, title: "Examen Parcial 2", value: 90 },
    { studentId: students[3].id, subjectId: math.id, title: "Examen Parcial 2", value: 72 },
  ];

  for (const m of markDefs) {
    const existing = await prisma.mark.findFirst({
      where: { tenantId: tenant.id, studentId: m.studentId, subjectId: m.subjectId, title: m.title },
    });
    if (!existing) {
      await prisma.mark.create({
        data: { tenantId: tenant.id, teacherId: teacher1.id, period: 1, maxValue: 100, isPublished: true, ...m },
      });
    }
  }

  // ── Tareas ────────────────────────────────────────────────────────────────
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const inTwoWeeks = new Date(); inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

  const hw1 = await upsertHomework(tenant.id, teacher1.id, math.id, group5A.id, "Examen Parcial - Fracciones", tomorrow);
  const hw2 = await upsertHomework(tenant.id, teacher1.id, math.id, group6B.id, "Tarea: Ecuaciones Lineales", tomorrow);
  const hw3 = await upsertHomework(tenant.id, teacher1.id, algebra.id, group6A.id, "Proyecto: Geometría en la vida real", inTwoWeeks);
  const hw4 = await upsertHomework(tenant.id, teacher1.id, math.id, group5A.id, "Ejercicios: Fracciones mixtas", tomorrow);
  const hw5 = await upsertHomework(tenant.id, teacher2.id, spanish.id, group5A.id, "Lectura: Capítulo 8", nextWeek);

  // Entregas parciales para las tareas
  const group5AStudents = students.filter((s) => s.groupId === group5A.id);
  for (let i = 0; i < group5AStudents.length; i++) {
    await prisma.homeworkSubmission.upsert({
      where: { homeworkId_studentId: { homeworkId: hw1.id, studentId: group5AStudents[i].id } },
      update: {},
      create: {
        homeworkId: hw1.id,
        studentId: group5AStudents[i].id,
        status: i < 2 ? "SUBMITTED" : "PENDING",
        submittedAt: i < 2 ? new Date() : null,
      },
    });
  }

  // ── Asistencia ────────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(8, 0, 0, 0);
  const session = await prisma.attendanceSession.upsert({
    where: { id: "seed-session-001" },
    update: {},
    create: {
      id: "seed-session-001",
      tenantId: tenant.id,
      scheduleId: createdSchedules[0]?.id ?? null,
      groupId: group5A.id,
      teacherId: teacher1.id,
      date: today,
      isOpen: false,
    },
  });

  const statuses: AttendanceStatus[] = ["PRESENT", "PRESENT", "LATE", "PRESENT"];
  for (let i = 0; i < group5AStudents.length; i++) {
    await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: group5AStudents[i].id } },
      update: {},
      create: {
        sessionId: session.id,
        studentId: group5AStudents[i].id,
        status: statuses[i] ?? "PRESENT",
      },
    });
  }

  // ── Mensajes ──────────────────────────────────────────────────────────────
  const msgDefs = [
    { fromId: guardianUser.id, toId: teacher1User.id, subject: "Consulta sobre el progreso en matemáticas", body: "Buenas tardes, quería consultar sobre el progreso de María en matemáticas este periodo.", isRead: false },
    { fromId: adminUser.id, toId: teacher1User.id, subject: "Recordatorio: Entrega de calificaciones parciales", body: "Estimado profesor, le recordamos que la fecha límite para la entrega de calificaciones parciales es el viernes.", isRead: false },
    { fromId: teacher1User.id, toId: guardianUser.id, subject: "Re: Progreso de María", body: "Hola Rosa, María está teniendo un excelente rendimiento. Su nota en el último parcial fue 95.", isRead: true },
  ];

  for (const m of msgDefs) {
    const exists = await prisma.message.findFirst({ where: { tenantId: tenant.id, fromId: m.fromId, subject: m.subject } });
    if (!exists) await prisma.message.create({ data: { tenantId: tenant.id, ...m } });
  }

  // ── Comunicados ───────────────────────────────────────────────────────────
  const annDefs = [
    { title: "Reunión de Padres - 15 de marzo", body: "Invitamos a todos los padres de familia a la reunión general del próximo 15 de marzo a las 16:00." },
    { title: "Festival de Primavera", body: "El 22 de marzo celebraremos nuestro Festival de Primavera. Todos los estudiantes deben usar uniforme de gala." },
    { title: "Entrega de Boletines", body: "Los boletines del primer periodo estarán disponibles a partir del 20 de marzo." },
  ];

  for (const a of annDefs) {
    const exists = await prisma.announcement.findFirst({ where: { tenantId: tenant.id, title: a.title } });
    if (!exists) await prisma.announcement.create({ data: { tenantId: tenant.id, ...a } });
  }

  console.log("✅ Seed completado.");
  console.log("\n📋 Credenciales demo:");
  console.log("  Admin:    admin@demo.classia.co  / demo123");
  console.log("  Profesor: lopez@demo.classia.co  / demo123");
  console.log("  Padre:    rosa@demo.classia.co   / demo123");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(tenantId: string, email: string, passwordHash: string, firstName: string, lastName: string, role: string) {
  return prisma.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {},
    create: { tenantId, email, passwordHash, firstName, lastName, role: role as UserRole },
  });
}

async function upsertSubject(tenantId: string, name: string, code: string) {
  const existing = await prisma.subject.findFirst({ where: { tenantId, code } });
  if (existing) return existing;
  return prisma.subject.create({ data: { tenantId, name, code } });
}

async function upsertGroup(tenantId: string, name: string, grade: string, section: string) {
  const existing = await prisma.group.findFirst({ where: { tenantId, grade, section } });
  if (existing) return existing;
  return prisma.group.create({ data: { tenantId, name, grade, section } });
}

async function upsertHomework(tenantId: string, teacherId: string, subjectId: string, groupId: string, title: string, dueDate: Date) {
  const existing = await prisma.homework.findFirst({ where: { tenantId, teacherId, title } });
  if (existing) return existing;
  return prisma.homework.create({ data: { tenantId, teacherId, subjectId, groupId, title, dueDate } });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
