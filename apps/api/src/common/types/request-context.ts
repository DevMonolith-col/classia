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
