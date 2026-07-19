import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { getPermissionsForRole } from "../permissions/permissions";
import { AuthTokenPayload } from "../../modules/auth/auth.types";

export async function verifyAndDecodeToken(
  token: string,
  jwt: JwtService,
  config: ConfigService
) {
  try {
    const payload = await jwt.verifyAsync<AuthTokenPayload>(token, {
      secret: config.get<string>("JWT_SECRET"),
    });

    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      membershipId: payload.membershipId,
      role: payload.role,
      permissions: getPermissionsForRole(payload.role),
      isImpersonated: payload.isImpersonated,
    };
  } catch (error) {
    throw new Error("Invalid token", { cause: error });
  }
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    
    // Auth token can be passed in handshake auth object or headers
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace("Bearer ", "");
    
    if (!token) {
      throw new WsException("Unauthorized");
    }

    try {
      const user = await verifyAndDecodeToken(token, this.jwt, this.config);
      // Attach user to socket data so it can be accessed in handlers
      client.data.user = user;
      return true;
    } catch {
      throw new WsException("Unauthorized");
    }
  }
}
