import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { Request } from "express";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { RequestUser } from "../types/request-context";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      throw new UnauthorizedException("Authenticated user is required.");
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const userPermissions = new Set(user?.permissions ?? []);
    const canAccess = requiredPermissions.every((permission) =>
      userPermissions.has(permission),
    );

    if (!canAccess) {
      throw new ForbiddenException("Insufficient permissions.");
    }

    return true;
  }
}
