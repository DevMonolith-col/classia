import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { Request } from "express";
import { PLATFORM_ROUTE_KEY } from "../decorators/platform-route.decorator";
import { RequestUser } from "../types/request-context";
import { verifyAndDecodeToken } from "./ws-jwt.guard";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Access token is required.");
    }

    const token = authorization.slice("Bearer ".length);
    // El try envuelve SOLO la verificación del token: si abarcara también el chequeo de
    // alcance, el 403 de assertPlatformScope saldría convertido en 401 por el catch, y un
    // "token inválido" mandaría al frontend a renovar la sesión en vez de mostrar que la
    // ruta no le corresponde a ese rol.
    let user: RequestUser;
    try {
      user = (await verifyAndDecodeToken(token, this.jwt, this.config)) as RequestUser;
    } catch {
      throw new UnauthorizedException("Invalid access token.");
    }

    this.assertPlatformScope(context, user);

    request.user = user;
    request.tenant = {
      id: user.tenantId,
      slug: user.tenantSlug,
      name: user.tenantSlug,
    };
    return true;
  }

  /**
   * El panel de Classia no es una puerta a los colegios.
   *
   * `SUPER_ADMIN` era el único rol con un pase libre de verdad: `PermissionsGuard` le
   * devuelve `true` sin mirar permisos, y `DataScopeGuard` se auto-anula cuando la sesión no
   * es de impersonación. Como el login exige membresía en el tenant, un `SUPER_ADMIN` que
   * tuviera membresía en un colegio —el seed hace exactamente eso con `demo`— entraba a
   * `/admin` y operaba con todo el poder: sin ticket, sin sesión de acceso aprobada, sin
   * vencimiento y sin la franja ámbar que le avisa al colegio que hay alguien de soporte
   * adentro. RLS no lo frena, porque lo scopea al tenant del JWT, que es justo el colegio
   * donde tiene la membresía.
   *
   * El camino legítimo no cambia: `auth.service#impersonate` exige un ticket de ese colegio
   * y una `AccessSession` CONCEDIDO/EMERGENCIA vigente, aprobada por un supervisor. Esa
   * sesión trae `isImpersonated`, así que pasa por acá y además queda gateada por
   * `DataScopeGuard`.
   *
   * Solo aplica a `SUPER_ADMIN`: los roles de soporte no tienen el bypass de permisos, así
   * que ya están acotados por lo que `ROLE_PERMISSIONS` les concede.
   */
  private assertPlatformScope(context: ExecutionContext, user: RequestUser) {
    if (user.role !== UserRole.SUPER_ADMIN || user.isImpersonated) {
      return;
    }

    const isPlatformRoute =
      this.reflector.getAllAndOverride<boolean>(PLATFORM_ROUTE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (!isPlatformRoute) {
      throw new ForbiddenException(
        "Un super administrador no opera un colegio directamente: se entra por impersonación, con un ticket y una sesión de acceso aprobada.",
      );
    }
  }
}
