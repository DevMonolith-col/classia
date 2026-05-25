import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GuardianService {
  constructor(private prisma: PrismaService) {}

  private async getGuardian(userId: string, tenantId: string) {
    const guardian = await this.prisma.guardian.findFirst({ where: { userId, tenantId } });
    if (!guardian) throw new NotFoundException("Perfil de acudiente no encontrado.");
    return guardian;
  }

  private async getChildrenIds(guardianId: string) {
    const links = await this.prisma.studentGuardian.findMany({
      where: { guardianId },
      select: { studentId: true },
    });
    return links.map((l) => l.studentId);
  }

  async getDashboard(userId: string, tenantId: string) {
    const guardian = await this.getGuardian(userId, tenantId);
    const studentIds = await this.getChildrenIds(guardian.id);

    if (studentIds.length === 0) {
      return { children: [], recentGrades: [], pendingHomework: [], recentAttendance: [], announcements: [] };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [children, recentGrades, pendingHomework, recentAttendance, announcements] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        include: { group: { select: { name: true, grade: true } } },
      }),
      this.prisma.mark.findMany({
        where: { studentId: { in: studentIds }, tenantId, date: { gte: sevenDaysAgo } },
        include: {
          subject: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),
      this.prisma.homework.findMany({
        where: {
          tenantId,
          dueDate: { gte: new Date() },
          group: { students: { some: { id: { in: studentIds } } } },
        },
        include: {
          subject: { select: { name: true } },
          group: { select: { name: true } },
          submissions: { where: { studentId: { in: studentIds } }, select: { studentId: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          session: { date: { gte: sevenDaysAgo } },
        },
        include: {
          session: {
            include: {
              schedule: {
                include: {
                  subject: { select: { name: true } },
                },
              },
              group: { select: { name: true, grade: true } },
            },
          },
          student: { select: { firstName: true, lastName: true } },
        },
        orderBy: { session: { date: "desc" } },
        take: 10,
      }),
      this.prisma.announcement.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      children: children.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        group: c.group ? `${c.group.grade} - ${c.group.name}` : null,
      })),
      recentGrades: recentGrades.map((m) => ({
        id: m.id,
        student: `${m.student.firstName} ${m.student.lastName}`,
        subject: m.subject.name,
        title: m.title,
        value: m.value,
        maxValue: m.maxValue,
        period: m.period,
        date: m.date,
      })),
      pendingHomework: pendingHomework.map((hw) => ({
        id: hw.id,
        title: hw.title,
        subject: hw.subject.name,
        group: hw.group.name,
        dueDate: hw.dueDate,
        submitted: hw.submissions.length > 0,
      })),
      recentAttendance: recentAttendance.map((r) => ({
        id: r.id,
        student: `${r.student.firstName} ${r.student.lastName}`,
        date: r.session.date,
        subject: r.session.schedule?.subject.name ?? "—",
        group: r.session.schedule
          ? null
          : `${r.session.group.grade} - ${r.session.group.name}`,
        status: r.status,
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        createdAt: a.createdAt,
      })),
    };
  }

  async getChildren(userId: string, tenantId: string) {
    const guardian = await this.getGuardian(userId, tenantId);
    const studentIds = await this.getChildrenIds(guardian.id);

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: {
        group: {
          include: {
            schedules: {
              include: {
                subject: { select: { name: true } },
                teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        },
      },
    });

    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      isActive: s.isActive,
      group: s.group
        ? {
            id: s.group.id,
            name: `${s.group.grade} - ${s.group.name}`,
            schedule: s.group.schedules.map((sch) => ({
              subject: sch.subject.name,
              teacher: `${sch.teacher.user.firstName} ${sch.teacher.user.lastName}`,
              dayOfWeek: sch.dayOfWeek,
              startTime: sch.startTime,
              endTime: sch.endTime,
            })),
          }
        : null,
    }));
  }

  async getGrades(userId: string, tenantId: string, studentId?: string) {
    const guardian = await this.getGuardian(userId, tenantId);
    const studentIds = await this.getChildrenIds(guardian.id);
    const filteredIds = studentId ? studentIds.filter((id) => id === studentId) : studentIds;

    const marks = await this.prisma.mark.findMany({
      where: { studentId: { in: filteredIds }, tenantId },
      include: {
        subject: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ student: { lastName: "asc" } }, { subject: { name: "asc" } }, { date: "desc" }],
    });

    const grouped: Record<string, any> = {};
    for (const m of marks) {
      const key = m.studentId;
      if (!grouped[key]) {
        grouped[key] = {
          student: `${m.student.firstName} ${m.student.lastName}`,
          subjects: {} as Record<string, any[]>,
        };
      }
      const subj = m.subject.name;
      if (!grouped[key].subjects[subj]) grouped[key].subjects[subj] = [];
      grouped[key].subjects[subj].push({
        id: m.id,
        title: m.title,
        value: m.value,
        maxValue: m.maxValue,
        period: m.period,
        date: m.date,
      });
    }

    return Object.values(grouped);
  }

  async getAttendance(userId: string, tenantId: string, studentId?: string) {
    const guardian = await this.getGuardian(userId, tenantId);
    const studentIds = await this.getChildrenIds(guardian.id);
    const filteredIds = studentId ? studentIds.filter((id) => id === studentId) : studentIds;

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: { in: filteredIds } },
      include: {
        session: {
          include: {
            schedule: {
              include: {
                subject: { select: { name: true } },
              },
            },
            group: { select: { name: true, grade: true } },
          },
        },
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: { session: { date: "desc" } },
      take: 50,
    });

    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, PERMISSION: 0 };
    for (const r of records) summary[r.status as keyof typeof summary]++;

    return {
      summary,
      records: records.map((r) => ({
        id: r.id,
        student: `${r.student.firstName} ${r.student.lastName}`,
        date: r.session.date,
        subject: r.session.schedule?.subject.name ?? "—",
        group: `${r.session.group.grade} - ${r.session.group.name}`,
        status: r.status,
      })),
    };
  }

  async getHomework(userId: string, tenantId: string, studentId?: string) {
    const guardian = await this.getGuardian(userId, tenantId);
    const studentIds = await this.getChildrenIds(guardian.id);
    const filteredIds = studentId ? studentIds.filter((id) => id === studentId) : studentIds;

    const students = await this.prisma.student.findMany({
      where: { id: { in: filteredIds } },
      select: { id: true, groupId: true },
    });

    const groupIds = [...new Set(students.map((s) => s.groupId).filter(Boolean))] as string[];

    const homework = await this.prisma.homework.findMany({
      where: { tenantId, groupId: { in: groupIds } },
      include: {
        subject: { select: { name: true } },
        group: { select: { name: true, grade: true } },
        submissions: {
          where: { studentId: { in: filteredIds } },
          include: { student: { select: { firstName: true, lastName: true } } },
        },
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
      submissions: hw.submissions.map((sub) => ({
        student: `${sub.student.firstName} ${sub.student.lastName}`,
        status: sub.status,
        submittedAt: sub.submittedAt,
      })),
    }));
  }

  async getMessages(userId: string, tenantId: string) {
    const [sent, received] = await Promise.all([
      this.prisma.message.findMany({
        where: { fromId: userId, tenantId },
        include: { to: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.message.findMany({
        where: { toId: userId, tenantId },
        include: { from: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return { sent, received };
  }
}
