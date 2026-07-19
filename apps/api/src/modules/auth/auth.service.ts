import { randomBytes, createHash } from "node:crypto";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccessScope, MembershipStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Request } from "express";
import { AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TenantContextService } from "../../core/tenant-context/tenant-context.service";
import { AccessControlService } from "../access-control/access-control.service";
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
    private readonly accessControl: AccessControlService,
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

    // Sesión de impersonación: se re-emite conservando el rol efectivo, el flag
    // y el ticket que la justificó, sin depender de ninguna membership (el
    // supervisor no la tiene en el tenant). Sin el ticketId, tras el primer
    // refresh DataScopeGuard perdería con qué AccessSession aislar el alcance —
    // el aislamiento por ticket no sobreviviría más de 15 minutos.
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
        ticketId: session.ticketId ?? undefined,
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
    // Antes solo un supervisor podía impersonar (chequeo de rol fijo). Ahora la
    // AccessSession aprobada es el gate real: solo un supervisor puede aprobar
    // una (ver access-control.service#approve/breakGlass), así que esto ya
    // subsume la restricción anterior sin bloquear al agente al que el
    // supervisor sí le aprobó el acceso. Se mantiene un filtro de rol amplio
    // como defensa en profundidad (roles no-soporte nunca tienen sesiones).
    const staffRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SUPPORT_SUPERVISOR, UserRole.SUPPORT_AGENT];
    if (!staffRoles.includes(currentUser.role)) {
      throw new UnauthorizedException("Solo el personal de soporte puede acceder al colegio de un tenant.");
    }

    const targetTenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });

    if (!targetTenant) {
      throw new UnauthorizedException("Target tenant not found.");
    }

    // El ticket debe existir y pertenecer al mismo colegio que se quiere entrar
    // — defensa en profundidad: sin esto alguien podría citar un ticket válido
    // de OTRO colegio para intentar colar el check de más abajo.
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: input.ticketId },
      select: { id: true, tenantId: true },
    });
    if (!ticket || ticket.tenantId !== targetTenant.id) {
      throw new ForbiddenException("El ticket no corresponde a este colegio.");
    }

    // La impersonación en sí ya no es autoservicio: exige una AccessSession
    // CONCEDIDO/EMERGENCIA vigente para ESTE ticket y este tenant (ver
    // access-control). Aislado por ticket a propósito: otra sesión activa del
    // mismo agente sobre el mismo colegio, aprobada para un ticket distinto, no
    // habilita entrar citando este. OPERATIVO es el mínimo: cualquier sesión
    // activa con ese alcance alcanza (el detalle de qué datos puede leer ya lo
    // decide DataScopeGuard endpoint por endpoint).
    const hasAccess = await this.accessControl.hasActiveScopeForTicket(
      currentUser.id,
      input.ticketId,
      targetTenant.id,
      AccessScope.OPERATIVO,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        "No tienes una sesión de acceso aprobada para este ticket. Solicítala antes de entrar.",
      );
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
      ticketId: input.ticketId,
      request,
    });

    await this.audit.record({
      tenantId: targetTenant.id,
      userId: currentUser.id,
      actorRole: sessionRole,
      action: "auth.impersonate",
      entityType: "Tenant",
      entityId: targetTenant.id,
      newValues: { ticketId: input.ticketId },
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
        // Igual que impersonatedRole: se persiste para que el refresh (más abajo
        // en este archivo) pueda re-embeber el mismo ticketId en el nuevo token.
        ticketId: input.isImpersonated ? (input.ticketId ?? null) : null,
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
      ticketId: input.isImpersonated ? input.ticketId : undefined,
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
