import { UserRole } from "@prisma/client";

export type RequestTenant = {
  id: string;
  slug: string;
  name: string;
};

export type RequestUser = {
  id: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  membershipId: string;
  role: UserRole;
  permissions?: string[];
  isImpersonated?: boolean;
  // Ticket que justificó esta impersonación (ver DataScopeGuard): presente
  // siempre que isImpersonated es true, ausente en sesiones normales.
  ticketId?: string;
};

declare global {
  namespace Express {
    interface Request {
      tenant?: RequestTenant;
      user?: RequestUser;
    }
  }
}

export {};
