import { randomBytes, createHash } from "node:crypto";
import { ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccessScope, MembershipStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Request } from "express";
import { AuditService } from "../../core/audit/audit.service";
import { PlatformAdminPrismaService } from "../../core/prisma/platform-admin-prisma.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";
import { TenantContextService } from "../../core/tenant-context/tenant-context.service";
import { AccessControlService } from "../access-control/access-control.service";
import { EmailService } from "../notifications/email/email.service";
import {
  ForgotPasswordInput,
  ImpersonateInput,
  LoginInput,
  RefreshTokenInput,
  ResetPasswordInput,
} from "./auth.schemas";
import { AuthTokenPayload } from "./auth.types";
import { RequestUser } from "../../common/types/request-context";

type CreateSessionInput = AuthTokenPayload & {
  request: Request;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly accessControl: AccessControlService,
    private readonly platformAdmin: PlatformAdminPrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
    private readonly email: EmailService,
  ) {}

  /** Una hora: suficiente para leer el correo, corto para un enlace que abre una cuenta. */
  private static readonly RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

  /**
   * Emite un enlace de restablecimiento, **si corresponde**.
   *
   * La respuesta es idéntica exista o no la cuenta, y eso no es cosmético: si dijera "ese
   * correo no está registrado", cualquiera podría averiguar qué familias pertenecen a un
   * colegio probando direcciones.
   *
   * Que el **cuerpo** sea idéntico no alcanza: el envío del correo va sin `await` para que el
   * tiempo de respuesta tampoco delate. Ver el comentario largo sobre eso más abajo.
   *
   * Cada emisión invalida las anteriores: pedir el enlace tres veces no deja tres llaves
   * vivas.
   */
  async forgotPassword(input: ForgotPasswordInput, request: Request) {
    const genericResponse = {
      status: "ok" as const,
      message: "Si el correo está registrado, enviaremos las instrucciones.",
    };

    const tenant = input.tenantSlug
      ? await this.tenantContext.resolveTenantBySlug(input.tenantSlug)
      : await this.tenantContext.resolveTenant(request);

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.status !== UserStatus.ACTIVE) return genericResponse;

    // Tiene que ser miembro del colegio desde el que pide el enlace. Sin esto, alguien de un
    // colegio podría emitir tokens contra cuentas de otro con solo conocer el correo.
    const membership = await this.tenantRlsContext.runWithTenant(tenant.id, () =>
      this.prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      }),
    );
    if (!membership || membership.status !== MembershipStatus.ACTIVE) return genericResponse;

    const token = randomBytes(48).toString("base64url");
    const tokenHash = this.hashRefreshToken(token);

    await this.tenantRlsContext.runWithTenant(tenant.id, async () => {
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.prisma.passwordResetToken.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + AuthService.RESET_TOKEN_TTL_MS),
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        },
      });
    });

    const webUrl = this.config.get<string>("app.webUrl") ?? "http://localhost:3000";
    const link = `${webUrl}/restablecer-password?token=${encodeURIComponent(token)}`;

    // **Sin `await` a propósito, y esto es parte de no filtrar qué correos existen.**
    //
    // Con `EMAIL_PROVIDER=resend` el envío es una llamada de red a la API de Resend: cientos
    // de milisegundos. Esperarla ataba el tiempo de respuesta a si la cuenta existe —el correo
    // desconocido volvía de inmediato y el real tardaba— así que cronometrar el endpoint
    // reconstruía exactamente el padrón que el mensaje genérico oculta. Los tests no lo veían
    // porque afirman sobre el cuerpo y el status, y ahí el flujo ya era idéntico.
    //
    // Queda la diferencia de dos consultas a la base, que es de milisegundos contra una red.
    // `EmailService.send` no lanza (atrapa todo y devuelve `failed`), pero el `.catch` va
    // igual: una promesa suelta sin catch tumba el proceso si algún día empieza a lanzar.
    void this.email
      .send({
        to: user.email,
        subject: `Restablece tu contraseña · ${tenant.name}`,
        html: `
        <p>Hola ${user.firstName},</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en
        <strong>${tenant.name}</strong>.</p>
        <p><a href="${link}">Crear una contraseña nueva</a></p>
        <p>El enlace vence en una hora y solo se puede usar una vez.</p>
        <p>Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>
      `,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `No se pudo enviar el correo de restablecimiento: ${(error as Error).message}`,
        );
      });

    // La auditoría va sobre el usuario y **sin el token**: el registro sirve para investigar
    // "¿quién pidió resetear esta cuenta?", no para poder usarlo.
    //
    // Dentro de `runWithTenant` porque este endpoint es público y corre sin JWT: no hay
    // contexto ambiente que el interceptor haya puesto, y `audit_logs` tiene FORCE RLS, así
    // que el insert lo rechaza la política con 42501 en vez de fallar por "cero filas".
    await this.tenantRlsContext.runWithTenant(tenant.id, () =>
      this.audit.record({
        tenantId: tenant.id,
        userId: user.id,
        actorRole: membership.role,
        action: "auth.password_reset_requested",
        entityType: "User",
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }),
    );

    return genericResponse;
  }

  /**
   * Consume el enlace y cambia la contraseña.
   *
   * El enlace se abre **sin sesión**, así que no hay contexto de tenant y la política de RLS
   * de `password_reset_tokens` devolvería cero filas. Ese único lookup va por el rol de
   * bypass, buscando por hash exacto y trayendo lo mínimo; todo lo que viene después ocurre
   * dentro de `runWithTenant` con el tenant que salió del token. Mismo patrón que
   * `CalendarFeedService#resolveTokenAcrossTenants`.
   */
  async resetPassword(input: ResetPasswordInput, request: Request) {
    const tokenHash = this.hashRefreshToken(input.token);

    const record = await this.platformAdmin.get().passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    // Un solo mensaje para "no existe", "ya se usó" y "venció": distinguirlos le diría a
    // quien pruebe enlaces al azar cuáles existieron alguna vez.
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("El enlace no es válido o ya venció.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    await this.tenantRlsContext.runWithTenant(record.tenantId, async () => {
      // Marcar por id **y** exigir que siga sin usar: si dos peticiones con el mismo enlace
      // llegan a la vez, la segunda actualiza cero filas y no cambia nada.
      const consumed = await this.prisma.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) {
        throw new UnauthorizedException("El enlace no es válido o ya venció.");
      }

      await this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
    });

    // La contraseña es global (vive en `users`), así que cerrar sesiones también tiene que
    // serlo: quien pidió el reseteo porque le robaron la cuenta no gana nada si la sesión del
    // atacante en otro colegio sigue viva. De ahí el bypass, y de ahí el nombre.
    await this.revokeAllSessionsAcrossTenants(record.userId);

    // Mismo motivo que en `forgotPassword`: sin JWT no hay contexto ambiente y `audit_logs`
    // tiene FORCE RLS.
    await this.tenantRlsContext.runWithTenant(record.tenantId, () =>
      this.audit.record({
        tenantId: record.tenantId,
        userId: record.userId,
        // Sin rol: quien consume el enlace no tiene sesión ni membresía resuelta, y ponerle un
        // rol inventado le mentiría a la bitácora sobre con qué autoridad se hizo el cambio.
        actorRole: undefined,
        action: "auth.password_reset_completed",
        entityType: "User",
        entityId: record.userId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }),
    );

    return { status: "ok" as const, message: "Tu contraseña quedó actualizada." };
  }

  /** Revoca todas las sesiones del usuario, en todos los colegios. Ver `resetPassword`. */
  private async revokeAllSessionsAcrossTenants(userId: string) {
    await this.platformAdmin.get().authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // AuthSession.tenantId es nullable (sesiones de plataforma sin colegio
  // asociado) -- si es null, la política de RLS de auth_sessions ya deja
  // pasar la fila sin importar el contexto, así que no hace falta
  // establecer ninguno. Si tiene tenantId, se establece explícitamente
  // (estos métodos corren off refresh-token/login, sin contexto ambiente
  // del interceptor HTTP -- docs/planning/aislamiento-rls-multitenant.md).
  private withSessionTenant<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T> {
    return tenantId ? this.tenantRlsContext.runWithTenant(tenantId, fn) : fn();
  }

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

    // login() corre sin ningún JWT todavía -- no hay contexto de tenant
    // ambiente del interceptor HTTP. Ya se conoce el tenant (resuelto por
    // slug/host arriba), así que se establece explícitamente para esta
    // lectura en vez de depender de contexto que no existe.
    const membership = await this.tenantRlsContext.runWithTenant(tenant.id, () =>
      this.prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId: user.id,
          },
        },
      }),
    );

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

    // audit.record() también escribe bajo RLS (audit_logs) y login() corre
    // sin contexto ambiente (sin JWT todavía) -- se envuelve igual que las
    // queries de arriba, si no el INSERT viola la política (tenantId no nulo
    // sin app.tenant_id seteado).
    await this.tenantRlsContext.runWithTenant(tenant.id, () =>
      this.audit.record({
        tenantId: tenant.id,
        userId: user.id,
        actorRole: membership.role,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }),
    );

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
    // refresh() corre off la cookie de refresh token, no del Bearer JWT --
    // no hay contexto de tenant ambiente del interceptor HTTP en este punto
    // (request.user nunca se pobló). No se sabe a qué tenant pertenece la
    // sesión hasta encontrarla, así que esta lectura usa el cliente de
    // bypass (igual para memberships anidado: se filtra por tenantId a mano
    // más abajo, así que da igual que bypass traiga las de todos los colegios).
    const session = await this.platformAdmin.get().authSession.findUnique({
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

    // Ligado acá (no `session.tenant.id` repetido): TS no re-angosta
    // `session.tenant` como no-nulo dentro de los closures de
    // withSessionTenant() más abajo (narrowing de property access no cruza
    // límites de función), y ya se validó arriba que existe.
    const tenantId = session.tenant.id;

    // Sesión de impersonación: se re-emite conservando el rol efectivo, el flag
    // y el ticket que la justificó, sin depender de ninguna membership (el
    // supervisor no la tiene en el tenant). Sin el ticketId, tras el primer
    // refresh DataScopeGuard perdería con qué AccessSession aislar el alcance —
    // el aislamiento por ticket no sobreviviría más de 15 minutos.
    if (session.isImpersonated) {
      // Antes de re-emitir, se vuelve a exigir una AccessSession activa para
      // ESTE ticket — igual que en impersonate(). Sin esto, revocar el acceso
      // no impedía que el refresh (válido hasta 30 días) siguiera reemitiendo
      // JWTs de impersonación indefinidamente; los datos seguían protegidos por
      // los guards de alcance, pero la sesión revivía en vez de morir en el
      // punto de reemisión. Si no hay ticketId (no debería pasar: impersonate()
      // lo exige desde la emisión) se trata igual que "sin acceso activo".
      const hasAccess =
        session.ticketId &&
        (await this.accessControl.hasActiveScopeForTicket(
          session.user.id,
          session.ticketId,
          session.tenant.id,
          AccessScope.OPERATIVO,
        ));

      if (!hasAccess) {
        await this.withSessionTenant(session.tenantId, () =>
          this.prisma.authSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          }),
        );

        await this.withSessionTenant(tenantId, () =>
          this.audit.record({
            tenantId,
            userId: session.user.id,
            actorRole: session.impersonatedRole ?? undefined,
            action: "auth.refresh_denied",
            entityType: "AuthSession",
            entityId: session.id,
            newValues: { reason: "access_session_inactive", ticketId: session.ticketId ?? undefined },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"],
          }),
        );

        throw new UnauthorizedException("La sesión de acceso para este ticket ya no está activa.");
      }

      await this.withSessionTenant(session.tenantId, () =>
        this.prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        }),
      );

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

      await this.withSessionTenant(tenantId, () =>
        this.audit.record({
          tenantId,
          userId: session.user.id,
          actorRole: impersonatedRole,
          action: "auth.refresh",
          entityType: "AuthSession",
          entityId: session.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        }),
      );

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

    await this.withSessionTenant(session.tenantId, () =>
      this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
    );

    const tokens = await this.createSession({
      sub: session.user.id,
      email: session.user.email,
      tenantId: session.tenant.id,
      tenantSlug: session.tenant.slug,
      membershipId: membership.id,
      role: membership.role,
      request,
    });

    await this.withSessionTenant(tenantId, () =>
      this.audit.record({
        tenantId,
        userId: session.user.id,
        actorRole: membership.role,
        action: "auth.refresh",
        entityType: "AuthSession",
        entityId: session.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }),
    );

    return tokens;
  }

  async logout(input: RefreshTokenInput, request: Request) {
    const refreshTokenHash = this.hashRefreshToken(input.refreshToken);
    // Igual que refresh(): corre off la cookie de refresh token, sin
    // contexto ambiente. Bypass para encontrar la sesión de cualquier tenant.
    const session = await this.platformAdmin.get().authSession.findUnique({
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

      await this.withSessionTenant(session.tenantId, () =>
        this.prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        }),
      );

      await this.withSessionTenant(session.tenantId, () =>
        this.audit.record({
          tenantId: session.tenantId ?? undefined,
          userId: session.userId,
          actorRole: membership?.role,
          action: "auth.logout",
          entityType: "AuthSession",
          entityId: session.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        }),
      );
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
    // de OTRO colegio para intentar colar el check de más abajo. Ya se conoce
    // targetTenant acá, así que se establece ese contexto para la lectura en
    // vez de depender del contexto ambiente del actor (que es SU PROPIO
    // tenant/ninguno, no necesariamente el del ticket que quiere citar).
    const ticket = await this.tenantRlsContext.runWithTenant(targetTenant.id, () =>
      this.prisma.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { id: true, tenantId: true },
      }),
    );
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

    // El actor (soporte) corre con SU PROPIO contexto ambiente (o ninguno),
    // no el de targetTenant -- se establece explícitamente para este write,
    // igual que para el resto de las escrituras de impersonate().
    await this.tenantRlsContext.runWithTenant(targetTenant.id, () =>
      this.audit.record({
        tenantId: targetTenant.id,
        userId: currentUser.id,
        actorRole: sessionRole,
        action: "auth.impersonate",
        entityType: "Tenant",
        entityId: targetTenant.id,
        newValues: { ticketId: input.ticketId },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }),
    );

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
    // Igual que refresh()/logout(): corre off la cookie de refresh token,
    // sin contexto ambiente. Bypass para encontrar la sesión.
    const session = await this.platformAdmin.get().authSession.findUnique({
      where: { refreshTokenHash },
    });

    if (session && !session.revokedAt && session.isImpersonated) {
      await this.withSessionTenant(session.tenantId, () =>
        this.prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        }),
      );

      await this.withSessionTenant(session.tenantId, () =>
        this.audit.record({
          tenantId: session.tenantId ?? undefined,
          userId: session.userId,
          actorRole: session.impersonatedRole ?? undefined,
          action: "auth.impersonate_ended",
          entityType: "AuthSession",
          entityId: session.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        }),
      );
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

    // Se llama desde login()/refresh()/impersonate(), ninguno de los cuales
    // garantiza contexto ambiente correcto (login y los refresh-flows corren
    // sin JWT/interceptor) -- se establece acá explícitamente para que este
    // write funcione sin importar quién llame, en vez de asumirlo.
    await this.tenantRlsContext.runWithTenant(input.tenantId, () =>
      this.prisma.authSession.create({
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
      }),
    );

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
