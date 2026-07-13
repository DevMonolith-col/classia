import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { getPermissionsForRole } from "../../common/permissions/permissions";
import { RequestUser } from "../../common/types/request-context";
import { PrismaService } from "../../core/prisma/prisma.service";

@Injectable()
export class BootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async getBootstrap(user: RequestUser) {
    const [currentUser, tenant, membership] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      }),
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: user.tenantId },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          primaryDomain: true,
          logoUrl: true,
          brandColor: true,
          timezone: true,
        },
      }),
      this.prisma.tenantMembership.findUniqueOrThrow({
        where: { id: user.membershipId },
        select: {
          id: true,
          role: true,
          status: true,
        },
      }),
    ]);

    return {
      user: currentUser,
      tenant,
      membership: {
        ...membership,
        permissions: getPermissionsForRole(membership.role),
      },
      summary: await this.buildRoleSummary(user),
    };
  }

  private async buildRoleSummary(user: RequestUser) {
    if (this.isAdminRole(user.role)) {
      const [users, groups, students, teachers, guardians] = await Promise.all([
        this.prisma.tenantMembership.count({
          where: { tenantId: user.tenantId },
        }),
        this.prisma.group.count({
          where: { tenantId: user.tenantId },
        }),
        this.prisma.student.count({
          where: { tenantId: user.tenantId },
        }),
        this.prisma.teacher.count({
          where: { tenantId: user.tenantId },
        }),
        this.prisma.guardian.count({
          where: { tenantId: user.tenantId },
        }),
      ]);

      return {
        kind: "admin",
        stats: {
          users,
          groups,
          students,
          teachers,
          guardians,
        },
      };
    }

    if (user.role === UserRole.TEACHER) {
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          tenantId: user.tenantId,
          userId: user.id,
        },
        select: {
          id: true,
          _count: {
            select: {
              schedules: true,
              homework: true,
              marks: true,
            },
          },
          schedules: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              room: true,
              group: {
                select: {
                  id: true,
                  name: true,
                  grade: true,
                  section: true,
                },
              },
              subject: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
            take: 5,
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          },
        },
      });

      return {
        kind: "teacher",
        teacher,
      };
    }

    if (user.role === UserRole.GUARDIAN) {
      const guardian = await this.prisma.guardian.findFirst({
        where: {
          tenantId: user.tenantId,
          userId: user.id,
        },
        select: {
          id: true,
          students: {
            select: {
              relationship: true,
              isPrimary: true,
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  documentId: true,
                  isActive: true,
                  group: {
                    select: {
                      id: true,
                      name: true,
                      grade: true,
                      section: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              student: {
                firstName: "asc",
              },
            },
          },
        },
      });

      return {
        kind: "guardian",
        guardian,
      };
    }

    if (user.role === UserRole.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: {
          tenantId: user.tenantId,
          userId: user.id,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentId: true,
          groupId: true,
          group: {
            select: { id: true, name: true, grade: true, section: true },
          },
        },
      });

      return {
        kind: "student",
        student,
      };
    }

    return {
      kind: "basic",
    };
  }

  private isAdminRole(role: UserRole) {
    const adminRoles = new Set<UserRole>([
      UserRole.SUPER_ADMIN,
      UserRole.SUPPORT_AGENT,
      UserRole.TENANT_ADMIN,
      UserRole.PRINCIPAL,
      UserRole.COORDINATOR,
      UserRole.SECRETARY,
    ]);

    return adminRoles.has(role);
  }
}
