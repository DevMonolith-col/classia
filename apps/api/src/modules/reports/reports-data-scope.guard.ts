import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { AccessScope, AccessSessionStatus } from "@prisma/client"
import { Request } from "express"
import { PrismaService } from "../../core/prisma/prisma.service"
import { RequestUser } from "../../common/types/request-context"

// reports.generate/preview/createSchedule no se pueden clasificar por ruta: el
// mismo endpoint sirve tanto reportes operativos (COURSES) como de datos
// personales (ATTENDANCE/GRADES/STUDENTS/TEACHERS/FINANCIAL) según el `type` del
// body. Este guard reemplaza a DataScopeGuard/@DataScope para este controller
// (ver DETENTE SI: "reports y files no se pueden clasificar por ruta" — el
// usuario eligió resolverlo con inspección del payload en vez de clasificar
// todo el módulo como DATOS_PERSONALES).
const OPERATIVO_REPORT_TYPES = new Set(["COURSES"])

@Injectable()
export class ReportsDataScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const user = request.user as RequestUser | undefined
    if (!user || !user.isImpersonated) return true

    // Aislado por ticket, igual que DataScopeGuard — ver ese archivo para el
    // razonamiento completo.
    if (!user.ticketId) {
      throw new ForbiddenException("Esta sesión de impersonación no tiene un ticket asociado; vuelve a entrar desde el ticket.")
    }

    const type = (request.body as { type?: string } | undefined)?.type
    const requiredScope = type && OPERATIVO_REPORT_TYPES.has(type) ? AccessScope.OPERATIVO : AccessScope.DATOS_PERSONALES

    const activeSession = await this.prisma.accessSession.findFirst({
      where: {
        requestedById: user.id,
        ticketId: user.ticketId,
        tenantId: user.tenantId,
        status: { in: [AccessSessionStatus.CONCEDIDO, AccessSessionStatus.EMERGENCIA] },
        expiresAt: { gt: new Date() },
        ...(requiredScope === AccessScope.DATOS_PERSONALES ? { scope: AccessScope.DATOS_PERSONALES } : {}),
      },
      select: { id: true },
    })

    if (!activeSession) {
      throw new ForbiddenException(
        requiredScope === AccessScope.DATOS_PERSONALES
          ? "Este reporte requiere una sesión de acceso con alcance de datos personales aprobada por el colegio para este ticket."
          : "Este reporte requiere una sesión de acceso aprobada por el colegio para este ticket.",
      )
    }

    return true
  }
}
