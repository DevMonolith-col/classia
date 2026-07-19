import { UserRole } from "@prisma/client";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  membershipId: string;
  role: UserRole;
  isImpersonated?: boolean;
  // Ticket que justificó esta impersonación (ver DataScopeGuard): presente
  // siempre que isImpersonated es true, ausente en sesiones normales.
  ticketId?: string;
};
