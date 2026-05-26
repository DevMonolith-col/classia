import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MembershipStatus, TenantStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";

const DEMO_TENANT_SLUG = "demo";
const DEMO_PASSWORD = "ClassiaDemo2026!";
const TENANT_ADMIN_EMAIL = "tenant-admin.e2e@classia.test";
const TEACHER_EMAIL = "teacher.e2e@classia.test";

type ApiResponse<T> = {
  status: number;
  body: T;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: {
    id: string;
    email: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  membership: {
    id: string;
    role: string;
  };
};

type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
};

type AuditLogsResponse = {
  items: Array<{
    id: string;
    tenantId: string | null;
    userId: string | null;
    actorRole: string | null;
    action: string;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    nextCursor?: string;
  };
};

describe("Backend v1 e2e", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();
    await ensureDemoE2eUsers(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves health and resolves the demo tenant", async () => {
    const health = await api<{ status: string; service: string }>("/health");
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({
      status: "ok",
      service: "classia-api",
    });

    const tenant = await api<{ slug: string; name: string }>("/tenants/current", {
      headers: tenantHeaders(),
    });
    expect(tenant.status).toBe(200);
    expect(tenant.body).toMatchObject({
      slug: DEMO_TENANT_SLUG,
      name: "Colegio Demo Classia",
    });
  });

  it("authenticates the tenant admin and returns the current JWT context", async () => {
    const login = await loginAs(TENANT_ADMIN_EMAIL);
    expect(login.status).toBe(201);
    expect(login.body).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 900,
      user: {
        email: TENANT_ADMIN_EMAIL,
      },
      tenant: {
        slug: DEMO_TENANT_SLUG,
      },
      membership: {
        role: "TENANT_ADMIN",
      },
    });
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));

    const me = await api<{ user: { email: string; role: string; tenantSlug: string } }>(
      "/auth/me",
      {
        headers: authHeaders(login.body.accessToken),
      },
    );
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({
      email: TENANT_ADMIN_EMAIL,
      role: "TENANT_ADMIN",
      tenantSlug: DEMO_TENANT_SLUG,
    });
  });

  it("rejects invalid credentials, invalid payloads, and missing tokens", async () => {
    const invalidPassword = await api<ErrorResponse>("/auth/login", {
      method: "POST",
      headers: jsonHeaders(tenantHeaders()),
      body: JSON.stringify({
        email: TENANT_ADMIN_EMAIL,
        password: "wrong-password",
        tenantSlug: DEMO_TENANT_SLUG,
      }),
    });
    expect(invalidPassword.status).toBe(401);
    expect(invalidPassword.body.message).toBe("Invalid credentials.");

    const invalidPayload = await api<ErrorResponse>("/auth/login", {
      method: "POST",
      headers: jsonHeaders(tenantHeaders()),
      body: JSON.stringify({
        email: TENANT_ADMIN_EMAIL,
        password: "bad",
        tenantSlug: DEMO_TENANT_SLUG,
      }),
    });
    expect(invalidPayload.status).toBe(400);
    expect(invalidPayload.body.message).toBe("Validation failed.");

    const missingToken = await api<ErrorResponse>("/auth/me");
    expect(missingToken.status).toBe(401);
    expect(missingToken.body.message).toBe("Access token is required.");
  });

  it("refreshes and revokes refresh tokens on logout", async () => {
    const login = await loginAs(TENANT_ADMIN_EMAIL);

    const refresh = await api<LoginResponse>("/auth/refresh", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        refreshToken: login.body.refreshToken,
      }),
    });
    expect(refresh.status).toBe(201);
    expect(refresh.body.accessToken).toEqual(expect.any(String));
    expect(refresh.body.refreshToken).toEqual(expect.any(String));

    const logout = await api<{ status: string }>("/auth/logout", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        refreshToken: refresh.body.refreshToken,
      }),
    });
    expect(logout.status).toBe(201);
    expect(logout.body).toEqual({ status: "ok" });

    const revokedRefresh = await api<ErrorResponse>("/auth/refresh", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        refreshToken: refresh.body.refreshToken,
      }),
    });
    expect(revokedRefresh.status).toBe(401);
    expect(revokedRefresh.body.message).toBe("Invalid refresh token.");
  });

  it("exposes tenant-scoped audit logs only to roles with audit permission", async () => {
    const tenantAdmin = await loginAs(TENANT_ADMIN_EMAIL);
    const audit = await api<AuditLogsResponse>("/audit/logs?limit=5", {
      headers: authHeaders(tenantAdmin.body.accessToken),
    });

    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body.items)).toBe(true);
    expect(audit.body.pageInfo).toEqual(
      expect.objectContaining({ hasNextPage: expect.any(Boolean) }),
    );
    expect(audit.body.items.length).toBeGreaterThan(0);
    expect(audit.body.items.every((item) => item.tenantId === tenantAdmin.body.tenant.id)).toBe(
      true,
    );

    const outsideTenant = await api<ErrorResponse>(
      "/audit/logs?tenantId=tenant-outside-demo&limit=1",
      {
        headers: authHeaders(tenantAdmin.body.accessToken),
      },
    );
    expect(outsideTenant.status).toBe(403);
    expect(outsideTenant.body.message).toBe("Audit logs are outside of current tenant.");

    const teacher = await loginAs(TEACHER_EMAIL);
    expect(teacher.status).toBe(201);
    const forbidden = await api<ErrorResponse>("/audit/logs?limit=1", {
      headers: authHeaders(teacher.body.accessToken),
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe("Insufficient permissions.");
  });

  async function loginAs(email: string): Promise<ApiResponse<LoginResponse>> {
    return api<LoginResponse>("/auth/login", {
      method: "POST",
      headers: jsonHeaders(tenantHeaders()),
      body: JSON.stringify({
        email,
        password: DEMO_PASSWORD,
        tenantSlug: DEMO_TENANT_SLUG,
      }),
    });
  }

  async function api<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    const body = text ? (JSON.parse(text) as T) : (undefined as T);

    return {
      status: response.status,
      body,
    };
  }
});

function tenantHeaders(): Record<string, string> {
  return {
    "x-tenant-slug": DEMO_TENANT_SLUG,
  };
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

function jsonHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    ...headers,
  };
}

async function ensureDemoE2eUsers(prisma: PrismaService) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: {
      name: "Colegio Demo Classia",
      status: TenantStatus.DEMO,
    },
    create: {
      slug: DEMO_TENANT_SLUG,
      name: "Colegio Demo Classia",
      primaryDomain: "app.demo.classia.com.co",
      status: TenantStatus.DEMO,
      brandColor: "#2563eb",
    },
  });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await ensureUserWithMembership(prisma, {
    tenantId: tenant.id,
    email: TENANT_ADMIN_EMAIL,
    firstName: "Tenant Admin",
    lastName: "E2E",
    passwordHash,
    role: UserRole.TENANT_ADMIN,
  });
  await ensureUserWithMembership(prisma, {
    tenantId: tenant.id,
    email: TEACHER_EMAIL,
    firstName: "Teacher",
    lastName: "E2E",
    passwordHash,
    role: UserRole.TEACHER,
  });
}

async function ensureUserWithMembership(
  prisma: PrismaService,
  input: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    role: UserRole;
  },
) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: input.tenantId,
        userId: user.id,
      },
    },
    update: {
      role: input.role,
      status: MembershipStatus.ACTIVE,
    },
    create: {
      tenantId: input.tenantId,
      userId: user.id,
      role: input.role,
      status: MembershipStatus.ACTIVE,
    },
  });
}
