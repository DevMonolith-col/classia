import { PrismaService } from "../../core/prisma/prisma.service";

/** Zona por defecto cuando el tenant no la tiene seteada. Coincide con el default del schema. */
export const DEFAULT_TIMEZONE = "America/Bogota";

/**
 * Zona horaria del colegio. Función y no método porque la necesitan tres servicios que no
 * comparten jerarquía (reports, events, attendance) y ya iba camino a la tercera copia
 * idéntica.
 *
 * Corre con el Prisma de la app, así que hereda el contexto de tenant del request: leer el
 * tenant de otro colegio devuelve null y cae al default, que es lo que se quiere.
 */
export async function resolveTenantTimezone(
  prisma: PrismaService,
  tenantId: string,
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  return tenant?.timezone || DEFAULT_TIMEZONE;
}
