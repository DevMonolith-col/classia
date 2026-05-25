import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalStudents, totalTeachers, totalGroups, todaySessions] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, isActive: true } }),
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.group.count({ where: { tenantId } }),
      this.prisma.attendanceSession.findMany({
        where: { tenantId, date: { gte: today, lt: tomorrow } },
        include: {
          _count: { select: { records: true } },
          records: { where: { status: "PRESENT" } },
        },
      }),
    ]);

    const totalRecords = todaySessions.reduce((sum, s) => sum + s._count.records, 0);
    const presentRecords = todaySessions.reduce((sum, s) => sum + s.records.length, 0);
    const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    const [recentActivity, upcomingHomework] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.homework.findMany({
        where: { tenantId, dueDate: { gte: new Date() } },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: {
          subject: { select: { name: true } },
          group: { select: { name: true } },
        },
      }),
    ]);

    return {
      stats: { totalStudents, totalTeachers, totalGroups, todayAttendanceRate: attendanceRate },
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        actorRole: log.actorRole,
        createdAt: log.createdAt,
      })),
      upcomingEvents: upcomingHomework.map((hw) => ({
        id: hw.id,
        title: hw.title,
        subject: hw.subject.name,
        group: hw.group.name,
        dueDate: hw.dueDate,
      })),
    };
  }

  async getStudents(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId },
        skip,
        take: limit,
        include: {
          group: { select: { name: true, grade: true } },
          guardians: {
            include: {
              guardian: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
            take: 1,
          },
        },
        orderBy: { lastName: "asc" },
      }),
      this.prisma.student.count({ where: { tenantId } }),
    ]);

    return {
      data: students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        isActive: s.isActive,
        group: s.group ? `${s.group.grade} - ${s.group.name}` : null,
        guardian: s.guardians[0]
          ? `${s.guardians[0].guardian.user.firstName} ${s.guardians[0].guardian.user.lastName}`
          : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTeachers(tenantId: string) {
    const teachers = await this.prisma.teacher.findMany({
      where: { tenantId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
        schedules: { include: { subject: { select: { name: true } } } },
      },
    });

    return teachers.map((t) => ({
      id: t.id,
      firstName: t.user.firstName,
      lastName: t.user.lastName,
      email: t.user.email,
      isActive: t.user.isActive,
      subjects: [...new Set(t.schedules.map((s) => s.subject.name))],
      scheduleCount: t.schedules.length,
    }));
  }

  async getCourses(tenantId: string) {
    const groups = await this.prisma.group.findMany({
      where: { tenantId },
      include: {
        _count: { select: { students: true } },
        schedules: {
          include: {
            subject: { select: { name: true } },
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      grade: g.grade,
      studentCount: g._count.students,
      subjects: g.schedules.map((sch) => ({
        subject: sch.subject.name,
        teacher: `${sch.teacher.user.firstName} ${sch.teacher.user.lastName}`,
        dayOfWeek: sch.dayOfWeek,
        startTime: sch.startTime,
        endTime: sch.endTime,
      })),
    }));
  }

  async getMessages(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { tenantId },
        skip,
        take: limit,
        include: {
          from: { select: { firstName: true, lastName: true, role: true } },
          to: { select: { firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.message.count({ where: { tenantId } }),
    ]);

    return {
      data: messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        body: m.body,
        isRead: m.isRead,
        createdAt: m.createdAt,
        from: `${m.from.firstName} ${m.from.lastName}`,
        fromRole: m.from.role,
        to: `${m.to.firstName} ${m.to.lastName}`,
        toRole: m.to.role,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAnnouncements(tenantId: string) {
    return this.prisma.announcement.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
}
