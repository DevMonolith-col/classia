import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { AuthTokenPayload } from "../../modules/auth/auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Access token is required.");
    }

    const token = authorization.slice("Bearer ".length);
    const payload = await this.jwt
      .verifyAsync<AuthTokenPayload>(token, {
        secret: this.config.get<string>("JWT_SECRET"),
      })
      .catch(() => {
        throw new UnauthorizedException("Invalid access token.");
      });

    request.user = {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      membershipId: payload.membershipId,
      role: payload.role,
      permissions: [`role:${payload.role}`],
    };
    request.tenant = {
      id: payload.tenantId,
      slug: payload.tenantSlug,
      name: payload.tenantSlug,
    };

    return true;
  }
}
