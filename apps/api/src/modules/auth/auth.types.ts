import { UserRole } from "@prisma/client";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  membershipId: string;
  role: UserRole;
  isImpersonated?: boolean;
};
