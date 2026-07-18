import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { getPermissionsForRole } from "../permissions/permissions";
import { AuthTokenPayload } from "../../modules/auth/auth.types";
import { verifyAndDecodeToken } from "./ws-jwt.guard";

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
    try {
      const user = await verifyAndDecodeToken(token, this.jwt, this.config);
      request.user = user;
      request.tenant = {
        id: user.tenantId as string,
        slug: user.tenantSlug as string,
        name: user.tenantSlug as string,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid access token.");
    }

    return true;
  }
}
