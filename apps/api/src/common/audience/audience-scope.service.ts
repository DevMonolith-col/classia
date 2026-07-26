import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../core/prisma/prisma.service";
import { RequestUser } from "../types/request-context";

/**
 * Resolución de "qué grupos le corresponden a este usuario", que es la mitad del patrón de
 * audiencia que comparten comunicados y calendario (`targetRole` + `groupId`).
 *
 * Se extrajo de AnnouncementsService el 2026-07-26, cuando el módulo de calendario necesitó
 * exactamente la misma resolución. La agregación multi-fuente de la Fase 3 será el tercer
 * consumidor, así que la copia-pega habría escalado a tres.
 *
 * Ojo con el límite: esto es scoping por rol, no aislamiento de tenant. RLS defiende contra
 * "me olvidé el filtro"; que un acudiente solo vea a sus hijos es responsabilidad de este
 * código, y un error acá es un IDOR intra-tenant que ninguna política de Postgres atrapa.
 */
@Injectable()
export class AudienceScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Grupos a los que pertenece el usuario según su rol. Vacío para roles sin grupo. */
  async resolveUserGroupIds(actor: RequestUser): Promise<string[]> {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId: actor.id, tenantId: actor.tenantId },
        select: { groupId: true },
      });
      return student?.groupId ? [student.groupId] : [];
    }

    if (actor.role === UserRole.GUARDIAN) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { userId: actor.id, tenantId: actor.tenantId },
        select: { students: { select: { student: { select: { groupId: true } } } } },
      });
      const groupIds =
        guardian?.students
          .map((link) => link.student.groupId)
          .filter((groupId): groupId is string => Boolean(groupId)) ?? [];
      return [...new Set(groupIds)];
    }

    if (actor.role === UserRole.TEACHER) {
      return this.resolveTeacherGroupIds(actor);
    }

    return [];
  }

  /**
   * Estudiantes que el actor puede ver como "propios": él mismo si es alumno, sus hijos si es
   * acudiente. Vacío para cualquier otro rol — un profesor o un admin ven estudiantes por otras
   * vías, con sus propias reglas.
   *
   * Ojo: esto resuelve *a quiénes* puede mirar, no *qué* puede mirar de ellos. Quien consuma
   * esto sigue teniendo que pasar por el servicio del módulo dueño (por ejemplo
   * `PaymentsService#getStudentBalance`, que revalida la pertenencia por su cuenta).
   */
  async resolveOwnStudentIds(actor: RequestUser): Promise<string[]> {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId: actor.id, tenantId: actor.tenantId },
        select: { id: true },
      });
      return student ? [student.id] : [];
    }

    if (actor.role === UserRole.GUARDIAN) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { userId: actor.id, tenantId: actor.tenantId },
        select: { students: { select: { studentId: true } } },
      });
      return guardian?.students.map((link) => link.studentId) ?? [];
    }

    return [];
  }

  /** Grupos en los que el profesor tiene clase, vía Schedule. */
  async resolveTeacherGroupIds(actor: RequestUser): Promise<string[]> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!teacher) return [];

    const schedules = await this.prisma.schedule.findMany({
      where: { tenantId: actor.tenantId, teacherId: teacher.id },
      select: { groupId: true },
    });
    return [...new Set(schedules.map((schedule) => schedule.groupId))];
  }
}
