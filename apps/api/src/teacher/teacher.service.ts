import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TeacherService {
  constructor(private prisma: PrismaService) {}

  private async getTeacher(userId: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { userId, tenantId } });
    if (!teacher) throw new NotFoundException("Perfil de docente no encontrado.");
    return teacher;
  }

  async getDashboard(userId: string, tenantId: string) {
    const teacher = await this.getTeacher(userId, tenantId);
    const dayOfWeek = new Date().getDay();

    const [todaySchedule, pendingHomework, unreadMessages] = await Promise.all([
      this.prisma.schedule.findMany({
        where: { teacherId: teacher.id, tenantId, dayOfWeek },
        include: {
          subject: { select: { name: true } },
          group: { select: { name: true, grade: true, _count: { select: { students: true } } } },
        },
        orderBy: { startTime: "asc" },
      }),
      this.prisma.homework.findMany({
        where: { teacherId: teacher.id, tenantId, dueDate: { gte: new Date() } },
        include: {
          subject: { select: { name: true } },
          group: { select: { name: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      this.prisma.message.findMany({
        where: { toId: userId, tenantId, isRead: false },
        include: { from: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      todaySchedule: todaySchedule.map((s) => ({
        id: s.id,
        subject: s.subject.name,
        group: `${s.group.grade} - ${s.group.name}`,
        studentCount: s.group._count.students,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
      })),
      pendingHomework: pendingHomework.map((hw) => ({
        id: hw.id,
        title: hw.title,
        subject: hw.subject.name,
        group: hw.group.name,
        dueDate: hw.dueDate,
        submissionsCount: hw._count.submissions,
      })),
      unreadMessages: unreadMessages.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: `${m.from.firstName} ${m.from.lastName}`,
        fromRole: m.from.role,
        createdAt: m.createdAt,
      })),
    };
  }

  async getSchedule(userId: string, tenantId: string) {
    const teacher = await this.getTeacher(userId, tenantId);

    const schedules = await this.prisma.schedule.findMany({
      where: { teacherId: teacher.id, tenantId },
      include: {
        subject: { select: { name: true } },
        group: { select: { name: true, grade: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const byDay: Record<number, typeof schedules> = {};
    for (const s of schedules) {
      if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = [];
      byDay[s.dayOfWeek].push(s);
    }

    return Object.entries(byDay).map(([day, slots]) => ({
      dayOfWeek: +day,
      slots: slots.map((s) => ({
        id: s.id,
        subject: s.subject.name,
        group: `${s.group.grade} - ${s.group.name}`,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
      })),
    }));
  }

  async recordAttendance(
    userId: string,
    tenantId: string,
    body: { scheduleId: string; date: string; records: { studentId: string; status: string }[] },
  ) {
    const teacher = await this.getTeacher(userId, tenantId);

    const schedule = await this.prisma.schedule.findFirst({
      where: { id: body.scheduleId, teacherId: teacher.id, tenantId },
    });
    if (!schedule) throw new NotFoundException("Horario no encontrado.");

    const sessionDate = new Date(body.date);
    sessionDate.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { scheduleId: schedule.id, date: sessionDate },
    });
    if (existing) throw new BadRequestException("Ya existe una sesión de asistencia para esta fecha.");

    const session = await this.prisma.attendanceSession.create({
      data: {
        tenantId,
        scheduleId: schedule.id,
        groupId: schedule.groupId,
        teacherId: teacher.id,
        date: sessionDate,
        records: {
          create: body.records.map((r) => ({
            studentId: r.studentId,
            status: r.status as any,
          })),
        },
      },
    });

    return { sessionId: session.id, recordsCreated: body.records.length };
  }

  async getAttendanceSessions(userId: string, tenantId: string, groupId?: string) {
    const teacher = await this.getTeacher(userId, tenantId);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId,
        teacherId: teacher.id,
        ...(groupId ? { groupId } : {}),
      },
      include: {
        schedule: {
          include: {
            subject: { select: { name: true } },
            group: { select: { name: true, grade: true } },
          },
        },
        group: { select: { name: true, grade: true } },
        _count: { select: { records: true } },
        records: { where: { status: "PRESENT" } },
      },
      orderBy: { date: "desc" },
      take: 30,
    });

    return sessions.map((s) => ({
      id: s.id,
      date: s.date,
      subject: s.schedule?.subject.name ?? "—",
      group: s.schedule
        ? `${s.schedule.group.grade} - ${s.schedule.group.name}`
        : `${s.group.grade} - ${s.group.name}`,
      total: s._count.records,
      present: s.records.length,
    }));
  }

  async getHomework(userId: string, tenantId: string) {
    const teacher = await this.getTeacher(userId, tenantId);

    const homework = await this.prisma.homework.findMany({
      where: { teacherId: teacher.id, tenantId },
      include: {
        subject: { select: { name: true } },
        group: { select: { name: true, grade: true, _count: { select: { students: true } } } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: "desc" },
    });

    return homework.map((hw) => ({
      id: hw.id,
      title: hw.title,
      description: hw.description,
      subject: hw.subject.name,
      group: `${hw.group.grade} - ${hw.group.name}`,
      dueDate: hw.dueDate,
      totalStudents: hw.group._count.students,
      submissionsCount: hw._count.submissions,
    }));
  }

  async createHomework(
    userId: string,
    tenantId: string,
    body: { title: string; description?: string; subjectId: string; groupId: string; dueDate: string },
  ) {
    const teacher = await this.getTeacher(userId, tenantId);

    const schedule = await this.prisma.schedule.findFirst({
      where: { teacherId: teacher.id, subjectId: body.subjectId, groupId: body.groupId, tenantId },
    });
    if (!schedule) throw new BadRequestException("No tienes asignada esa materia en ese grupo.");

    return this.prisma.homework.create({
      data: {
        tenantId,
        title: body.title,
        description: body.description,
        subjectId: body.subjectId,
        groupId: body.groupId,
        teacherId: teacher.id,
        dueDate: new Date(body.dueDate),
      },
    });
  }

  async getMarks(userId: string, tenantId: string, groupId?: string, subjectId?: string) {
    const teacher = await this.getTeacher(userId, tenantId);

    const marks = await this.prisma.mark.findMany({
      where: {
        tenantId,
        teacherId: teacher.id,
        ...(groupId ? { student: { groupId } } : {}),
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
      },
      orderBy: [{ subject: { name: "asc" } }, { student: { lastName: "asc" } }],
    });

    return marks.map((m) => ({
      id: m.id,
      student: `${m.student.firstName} ${m.student.lastName}`,
      subject: m.subject.name,
      title: m.title,
      value: m.value,
      maxValue: m.maxValue,
      period: m.period,
      date: m.date,
    }));
  }

  async createMark(
    userId: string,
    tenantId: string,
    body: { studentId: string; subjectId: string; title: string; value: number; period: number; maxValue?: number },
  ) {
    const teacher = await this.getTeacher(userId, tenantId);

    const schedule = await this.prisma.schedule.findFirst({
      where: { teacherId: teacher.id, subjectId: body.subjectId, tenantId },
    });
    if (!schedule) throw new BadRequestException("No tienes acceso a esa materia.");

    return this.prisma.mark.create({
      data: {
        tenantId,
        studentId: body.studentId,
        subjectId: body.subjectId,
        teacherId: teacher.id,
        title: body.title,
        value: body.value,
        maxValue: body.maxValue ?? 100,
        period: body.period,
        date: new Date(),
      },
    });
  }

  async getGroups(userId: string, tenantId: string) {
    const teacher = await this.getTeacher(userId, tenantId);

    const schedules = await this.prisma.schedule.findMany({
      where: { teacherId: teacher.id, tenantId },
      include: {
        group: {
          include: {
            _count: { select: { students: true } },
            students: { orderBy: { lastName: "asc" } },
          },
        },
        subject: { select: { name: true } },
      },
      distinct: ["groupId"],
    });

    return schedules.map((s) => ({
      groupId: s.groupId,
      groupName: `${s.group.grade} - ${s.group.name}`,
      studentCount: s.group._count.students,
      students: s.group.students.map((st) => ({
        id: st.id,
        firstName: st.firstName,
        lastName: st.lastName,
      })),
    }));
  }
}
