import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { AccessScope, AccessSessionStatus } from "@prisma/client"
import { Request } from "express"
import { PrismaService } from "../../core/prisma/prisma.service"
import { DATA_SCOPE_KEY } from "../decorators/data-scope.decorator"
import { RequestUser } from "../types/request-context"

// Aditivo a PermissionsGuard, nunca lo reemplaza. Deliberadamente NO toca la
// lógica de bypass de SUPER_ADMIN en PermissionsGuard: aquí se evalúa aparte, y
// solo aplica cuando el request está en impersonación. El staff propio de un
// colegio (isImpersonated=false) nunca pasa por este guard.
//
// Endpoints sin @DataScope no quedan gateados (ver clasificación pendiente para
// los módulos ambiguos en docs/planning). Esto es una decisión explícita para no
// bloquear ciegamente accesos que no se han clasificado con confianza.
//
// Consulta Prisma directo (no AccessControlService) a propósito: AccessControlModule
// importa NotificationsModule (para el aviso de break-glass), y NotificationsModule
// ahora también trae @DataScope en su controller — importar AccessControlModule
// desde ahí crearía un ciclo. Este guard solo necesita un lookup de lectura, así
// que vive en su propio módulo liviano (data-scope.module.ts) sin esa dependencia.
@Injectable()
export class DataScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScope = this.reflector.getAllAndOverride<AccessScope | undefined>(DATA_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredScope) return true

    const request = context.switchToHttp().getRequest<Request>()
    const user = request.user as RequestUser | undefined
    if (!user || !user.isImpersonated) return true

    // Aislado por ticket: el JWT de impersonación siempre trae ticketId (ver
    // auth.service#impersonate, lo exige desde la emisión). Si falta — token
    // emitido antes de este cambio, o cualquier otra anomalía — se falla cerrado
    // en vez de caer a un alcance más amplio por (agente, colegio).
    if (!user.ticketId) {
      throw new ForbiddenException("Esta sesión de impersonación no tiene un ticket asociado; vuelve a entrar desde el ticket.")
    }

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
          ? "Este dato requiere una sesión de acceso con alcance de datos personales aprobada por el colegio para este ticket."
          : "Este dato requiere una sesión de acceso aprobada por el colegio para este ticket.",
      )
    }

    return true
  }
}
