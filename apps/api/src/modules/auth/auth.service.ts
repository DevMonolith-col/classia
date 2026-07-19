import { randomBytes, createHash } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MembershipStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Request } from "express";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TenantContextService } from "../../core/tenant-context/tenant-context.service";
import { LoginInput, RefreshTokenInput, ImpersonateInput } from "./auth.schemas";
import { AuthTokenPayload } from "./auth.types";
import { RequestUser } from "../../common/types/request-context";

type CreateSessionInput = AuthTokenPayload & {
  request: Request;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async login(input: LoginInput, request: Request) {
    const tenant = input.tenantSlug
      ? await this.tenantContext.resolveTenantBySlug(input.tenantSlug)
      : await this.tenantContext.resolveTenant(request);
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const passwordIsValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new UnauthorizedException("Tenant membership is not active.");
    }

    const tokens = await this.createSession({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      membershipId: membership.id,
      role: membership.role,
      request,
    });

    await this.audit.record({
      tenantId: tenant.id,
      userId: user.id,
      actorRole: membership.role,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tenant,
      membership: {
        id: membership.id,
        role: membership.role,
      },
    };
  }

  async refresh(input: RefreshTokenInput, request: Request) {
    const refreshTokenHash = this.hashRefreshToken(input.refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: {
        tenant: true,
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE ||
      !session.tenant
    ) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    // Sesión de impersonación: se re-emite conservando el rol efectivo y el flag,
    // sin depender de ninguna membership (el supervisor no la tiene en el tenant).
    // Sin esto, tras 15 min el token perdía isImpersonated y la auditoría dejaba
    // de registrar las mutaciones de la sesión impersonada.
    if (session.isImpersonated) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      const impersonatedRole = session.impersonatedRole ?? UserRole.TENANT_ADMIN;
      const tokens = await this.createSession({
        sub: session.user.id,
        email: session.user.email,
        tenantId: session.tenant.id,
        tenantSlug: session.tenant.slug,
        membershipId: "",
        role: impersonatedRole,
        isImpersonated: true,
        request,
      });

      await this.audit.record({
        tenantId: session.tenant.id,
        userId: session.user.id,
        actorRole: impersonatedRole,
        action: "auth.refresh",
        entityType: "AuthSession",
        entityId: session.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return tokens;
    }

    const membership = session.user.memberships.find(
      (item) =>
        item.tenantId === session.tenantId &&
        item.status === MembershipStatus.ACTIVE,
    );

    if (!membership) {
      throw new UnauthorizedException("Tenant membership is not active.");
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.createSession({
      sub: session.user.id,
      email: session.user.email,
      tenantId: session.tenant.id,
      tenantSlug: session.tenant.slug,
      membershipId: membership.id,
      role: membership.role,
      request,
    });

    await this.audit.record({
      tenantId: session.tenant.id,
      userId: session.user.id,
      actorRole: membership.role,
      action: "auth.refresh",
      entityType: "AuthSession",
      entityId: session.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return tokens;
  }

  async logout(input: RefreshTokenInput, request: Request) {
    const refreshTokenHash = this.hashRefreshToken(input.refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: {
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (session && !session.revokedAt) {
      const membership = session.user.memberships.find(
        (item) => item.tenantId === session.tenantId,
      );

      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await this.audit.record({
        tenantId: session.tenantId ?? undefined,
        userId: session.userId,
        actorRole: membership?.role,
        action: "auth.logout",
        entityType: "AuthSession",
        entityId: session.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
    }

    return {
      status: "ok",
    };
  }

  async impersonate(input: ImpersonateInput, currentUser: RequestUser, request: Request) {
    // Solo un supervisor (SUPER_ADMIN o SUPPORT_SUPERVISOR) puede entrar al
    // colegio de un tenant. Un agente de soporte (worker) nunca se
    // auto-otorga acceso, aunque tenga un ticket activo asignado: si hace
    // falta acceso, lo hace el supervisor.
    if (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "SUPPORT_SUPERVISOR") {
      throw new UnauthorizedException("Solo un supervisor puede acceder al colegio de un tenant.");
    }

    const targetTenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });

    if (!targetTenant) {
      throw new UnauthorizedException("Target tenant not found.");
    }

    // Sesión efímera: impersonar NO crea ni modifica ninguna TenantMembership.
    // El rol efectivo es TENANT_ADMIN (suficiente para operar el colegio) y vive
    // solo dentro de la AuthSession/token, marcado como impersonación. Así el
    // supervisor no queda con un cargo permanente en el tenant, y salir de la
    // impersonación (o dejar expirar la sesión) no deja rastro de acceso.
    const sessionRole = UserRole.TENANT_ADMIN;

    const tokens = await this.createSession({
      sub: currentUser.id,
      email: currentUser.email,
      tenantId: targetTenant.id,
      tenantSlug: targetTenant.slug,
      // La impersonación no tiene membership real: se usa un sentinel vacío y el
      // bootstrap sintetiza la membership a partir del rol de la sesión.
      membershipId: "",
      role: sessionRole,
      isImpersonated: true,
      request,
    });

    await this.audit.record({
      tenantId: targetTenant.id,
      userId: currentUser.id,
      actorRole: sessionRole,
      action: "auth.impersonate",
      entityType: "Tenant",
      entityId: targetTenant.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return {
      ...tokens,
      user: {
        id: currentUser.id,
        email: currentUser.email,
      },
      tenant: targetTenant,
      membership: {
        id: "",
        role: sessionRole,
      },
    };
  }

  // Salir de la impersonación: revoca la sesión efímera en el servidor. El cliente
  // conserva sus tokens originales y los restaura, pero sin esto la sesión de
  // impersonación (refresh de 30 días) seguiría viva y reutilizable.
  async exitImpersonation(input: RefreshTokenInput, request: Request) {
    const refreshTokenHash = this.hashRefreshToken(input.refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
    });

    if (session && !session.revokedAt && session.isImpersonated) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await this.audit.record({
        tenantId: session.tenantId ?? undefined,
        userId: session.userId,
        actorRole: session.impersonatedRole ?? undefined,
        action: "auth.impersonate_ended",
        entityType: "AuthSession",
        entityId: session.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
    }

    return { status: "ok" };
  }

  async signAccessToken(payload: AuthTokenPayload) {
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_SECRET"),
      expiresIn: "15m",
    });
  }

  private async createSession(input: CreateSessionInput) {
    const refreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await this.prisma.authSession.create({
      data: {
        userId: input.sub,
        tenantId: input.tenantId,
        refreshTokenHash,
        expiresAt,
        ipAddress: input.request.ip,
        userAgent: input.request.headers["user-agent"],
        isImpersonated: input.isImpersonated ?? false,
        // El rol efectivo de la impersonación se guarda para poder re-emitir el
        // token en cada refresh sin leer ninguna membership.
        impersonatedRole: input.isImpersonated ? input.role : null,
      },
    });

    const accessToken = await this.signAccessToken({
      sub: input.sub,
      email: input.email,
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
      membershipId: input.membershipId,
      role: input.role,
      isImpersonated: input.isImpersonated,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 900,
      refreshExpiresAt: expiresAt.toISOString(),
    };
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash("sha256").update(refreshToken).digest("hex");
  }
}
