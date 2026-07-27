import { Injectable, Logger } from "@nestjs/common";
import { PlatformAdminPrismaService } from "../../core/prisma/platform-admin-prisma.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";

export const PASSWORD_RESET_CLEANUP_QUEUE = "password-reset-cleanup";

/**
 * Una vez por día. No hay ninguna urgencia: una fila vencida no hace daño, solo ocupa lugar,
 * y el token que representa lleva muerto desde que pasó su hora de vida.
 */
export const CLEANUP_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Cuánto se conserva una fila **después** de vencida.
 *
 * El token vive una hora, así que a los 30 días la fila no cumple ninguna función funcional:
 * `resetPassword` responde exactamente igual ante "no existe", "ya se usó" y "venció", y quién
 * pidió y quién completó un reseteo ya quedó en `audit_logs` (`auth.password_reset_requested`
 * y `auth.password_reset_completed`), que es el registro que sí hay que conservar.
 *
 * El mes de gracia es para investigar un incidente reciente mirando la tabla misma —cuántos
 * enlaces se pidieron contra una cuenta, desde qué IP— sin tener que cruzar la bitácora.
 */
export const RESET_TOKEN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Barrido de los tokens de restablecimiento ya vencidos.
 *
 * La migración `20260727100000_password_reset_token` creó el índice sobre `expiresAt` "para
 * poder barrer los vencidos sin escanear la tabla entera" — y ese barrido no existía: la tabla
 * crecía una fila por solicitud, para siempre. Esto lo cierra.
 */
@Injectable()
export class PasswordResetCleanupService {
  private readonly logger = new Logger(PasswordResetCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAdmin: PlatformAdminPrismaService,
    private readonly tenantRlsContext: TenantRlsContextService,
  ) {}

  /**
   * Borra las filas vencidas hace más de `RESET_TOKEN_RETENTION_MS`, colegio por colegio.
   *
   * **El bypass abre la puerta a encontrarlas, no a borrarlas.** Es el mismo reparto que usa
   * `AccessControlService#expireOverdueSessions`: el cliente con `BYPASSRLS` solo descubre
   * *qué colegios* tienen filas viejas —no hay uno solo al que asociar este job— y el borrado
   * de cada uno corre dentro de `runWithTenant` con su propio tenant, así que la política de
   * RLS sigue siendo la barrera de abajo. Si alguien se equivoca en el `where`, borra de menos,
   * no de más.
   *
   * El `tenantId` explícito en el `deleteMany` es redundante con la política y va igual: deja
   * escrito el alcance para quien lea, en vez de que dependa de saber que hay RLS detrás.
   */
  async purgeExpiredTokens(): Promise<{ deleted: number; tenants: number }> {
    const cutoff = new Date(Date.now() - RESET_TOKEN_RETENTION_MS);

    const stale = await this.platformAdmin.get().passwordResetToken.findMany({
      where: { expiresAt: { lt: cutoff } },
      select: { tenantId: true },
      distinct: ["tenantId"],
    });

    let deleted = 0;
    for (const { tenantId } of stale) {
      const { count } = await this.tenantRlsContext.runWithTenant(tenantId, () =>
        this.prisma.passwordResetToken.deleteMany({
          where: { tenantId, expiresAt: { lt: cutoff } },
        }),
      );
      deleted += count;
    }

    if (deleted > 0) {
      this.logger.log(
        `Barrido de tokens de restablecimiento: ${deleted} fila(s) vencida(s) borrada(s) en ${stale.length} colegio(s).`,
      );
    }

    return { deleted, tenants: stale.length };
  }
}
