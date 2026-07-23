// Fase 7 (docs/planning/aislamiento-rls-multitenant.md): test de regresión
// dedicado a probar la garantía de aislamiento en sí -- no "el feature
// funciona" (eso ya lo cubre backend-v1.e2e-spec.ts), sino específicamente
// "un actor autenticado del Tenant A NUNCA puede leer ni escribir una
// entidad del Tenant B citando su ID directamente", incluyendo el caso de
// SUPER_ADMIN sin impersonar (el hueco documentado y dejado abierto a
// propósito en la Fase 2 -- debe fallar cerrado, nunca filtrar datos).
//
// Corre contra la app real (Postgres/Redis reales, RLS forzado), igual que
// el resto de la suite e2e. Archivo separado (no agregado a
// backend-v1.e2e-spec.ts) porque levanta su propio segundo tenant dedicado,
// y porque la naturaleza del test (adversarial, no funcional) amerita poder
// correrlo/leerlo de forma aislada.
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { TenantStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";
import { TenantRlsContextService } from "../src/core/prisma/tenant-rls-context.service";

const PASSWORD = "ClassiaDemo2026!";
const TENANT_A_SLUG = "demo";
const TENANT_A_ADMIN_EMAIL = "rls-e2e-tenant-a-admin@classia.test";
const TENANT_B_SLUG = "rls-e2e-tenant-b";
const TENANT_B_ADMIN_EMAIL = "rls-e2e-tenant-b-admin@classia.test";
const TENANT_B_TEACHER_EMAIL = "rls-e2e-tenant-b-teacher@classia.test";
// Sembrado por packages/database/prisma/seed.ts -- ya confirmado ACTIVE en
// vivo durante la verificación de Fase 2/8 de este mismo día.
const SUPER_ADMIN_EMAIL = "admin@classia.com.co";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tenant: { id: string; slug: string };
};

type ErrorResponse = {
  statusCode: number;
  message: string;
};

type Fixtures = {
  tenantAId: string;
  tenantBId: string;
  tenantBStudentId: string;
  tenantBTeacherId: string;
  tenantBGroupId: string;
};

describe("RLS cross-tenant isolation regression", () => {
  let app: INestApplication;
  let baseUrl: string;
  let fixtures: Fixtures;
  // /auth/login tiene rate-limit (20/min, ThrottlerGuard) -- un login fresco
  // por `it()` lo agota rápido y además le come cupo compartido a cualquier
  // otra suite e2e que corra en la misma ventana. Se loguea una sola vez por
  // identidad acá y se reusa el token en todos los tests.
  let tenantAAdminSession: LoginResponse;
  let superAdminSession: LoginResponse;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();

    fixtures = await ensureFixtures(app.get(PrismaService), app.get(TenantRlsContextService));
    tenantAAdminSession = await loginAs(TENANT_A_ADMIN_EMAIL, TENANT_A_SLUG);
    superAdminSession = await loginAs(SUPER_ADMIN_EMAIL, TENANT_A_SLUG);
  }, 180_000); // el retry-con-backoff de loginAs() ante 429 puede tardar más que el default de 5s

  afterAll(async () => {
    await app.close();
  });

  async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
  }

  // /auth/login está gateado por ThrottlerGuard (20/min por IP). Cuando esta
  // suite corre junto con backend-v1.e2e-spec.ts (mismo proceso jest, mismo
  // servidor, misma IP local) puede llegar a este endpoint con el cupo ya
  // casi agotado por la otra suite -- reintenta con backoff en vez de asumir
  // que el 429 nunca va a pasar.
  async function loginAs(email: string, tenantSlug: string, attempt = 1): Promise<LoginResponse> {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ email, password: PASSWORD, tenantSlug }),
    });
    if (res.status === 429 && attempt < 8) {
      // Backoff acumulado hasta ~85s en el peor caso -- suficiente para
      // cruzar la ventana completa de 60s del throttle aunque backend-v1.e2e-spec.ts
      // haya agotado el cupo justo antes de que arranque esta suite.
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
      return loginAs(email, tenantSlug, attempt + 1);
    }
    expect(res.status).toBe(201);
    return res.body;
  }

  function authHeaders(accessToken: string): Record<string, string> {
    return { authorization: `Bearer ${accessToken}` };
  }

  it("blocks a TENANT_ADMIN of tenant A from reading a student that belongs to tenant B", async () => {
    const res = await api<ErrorResponse>(`/students/${fixtures.tenantBStudentId}`, {
      headers: authHeaders(tenantAAdminSession.accessToken),
    });

    expect(res.status).toBe(404);
  });

  it("never returns tenant B's student in tenant A's student list", async () => {
    const res = await api<Array<{ id: string }>>("/students", {
      headers: authHeaders(tenantAAdminSession.accessToken),
    });

    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.id)).not.toContain(fixtures.tenantBStudentId);
  });

  it("blocks a TENANT_ADMIN of tenant A from updating a student that belongs to tenant B", async () => {
    const res = await api<ErrorResponse>(`/students/${fixtures.tenantBStudentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...authHeaders(tenantAAdminSession.accessToken) },
      body: JSON.stringify({ firstName: "Secuestrado" }),
    });

    expect(res.status).toBe(404);

    // Confirma que el intento de escritura no dejó rastro: el nombre del
    // estudiante de tenant B sigue siendo el original (vía bypass, ya que este
    // check corre fuera de cualquier request HTTP).
    const prisma = app.get(PrismaService);
    const tenantRlsContext = app.get(TenantRlsContextService);
    const student = await tenantRlsContext.runWithTenant(fixtures.tenantBId, () =>
      prisma.student.findUniqueOrThrow({ where: { id: fixtures.tenantBStudentId } }),
    );
    expect(student.firstName).not.toBe("Secuestrado");
  });

  it("blocks a TENANT_ADMIN of tenant A from reading a teacher that belongs to tenant B", async () => {
    const res = await api<ErrorResponse>(`/teachers/${fixtures.tenantBTeacherId}`, {
      headers: authHeaders(tenantAAdminSession.accessToken),
    });

    expect(res.status).toBe(404);
  });

  it("blocks a TENANT_ADMIN of tenant A from reading a group that belongs to tenant B", async () => {
    const res = await api<ErrorResponse>(`/groups/${fixtures.tenantBGroupId}`, {
      headers: authHeaders(tenantAAdminSession.accessToken),
    });

    expect(res.status).toBe(404);
  });

  // El hueco documentado a propósito en docs/planning/aislamiento-rls-multitenant.md
  // (Fase 2, "encontrado pero NO arreglado"): SUPER_ADMIN sin impersonar pasa el
  // chequeo de rol (isGlobalAdmin) en el código de la app, así que la única
  // defensa real contra leer otro tenant acá es RLS. Este test prueba
  // exactamente esa garantía -- si algún día se rompe (el mismo tipo de bug
  // que se encontró y arregló hoy en runWithTenant/$queryRaw), este test
  // debe fallar en rojo, no filtrar datos en silencio.
  it("SUPER_ADMIN without impersonating fails closed on tenant B's data (documented gap, must stay closed)", async () => {
    const res = await api<ErrorResponse>(`/students/${fixtures.tenantBStudentId}`, {
      headers: authHeaders(superAdminSession.accessToken),
    });

    expect(res.status).toBe(404);
  });

  it("sanity check: tenant A's admin CAN read tenant A's own data (rules out an over-broad 404-everything bug)", async () => {
    const res = await api<Array<{ id: string }>>("/students", {
      headers: authHeaders(tenantAAdminSession.accessToken),
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

async function ensureFixtures(
  prisma: PrismaService,
  tenantRlsContext: TenantRlsContextService,
): Promise<Fixtures> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // tenants/users no tienen RLS (globales) -- estos dos upserts corren sin
  // contexto, igual que en backend-v1.e2e-spec.ts.
  const tenantA = await prisma.tenant.upsert({
    where: { slug: TENANT_A_SLUG },
    update: {},
    create: {
      slug: TENANT_A_SLUG,
      name: "Colegio Demo Classia",
      primaryDomain: "app.demo.classia.com.co",
      status: TenantStatus.DEMO,
      brandColor: "#2563eb",
    },
  });

  const tenantB = await prisma.tenant.upsert({
    where: { slug: TENANT_B_SLUG },
    update: { status: TenantStatus.ACTIVE },
    create: {
      slug: TENANT_B_SLUG,
      name: "RLS E2E Tenant B",
      status: TenantStatus.ACTIVE,
    },
  });

  const tenantAAdminUser = await prisma.user.upsert({
    where: { email: TENANT_A_ADMIN_EMAIL },
    update: { status: UserStatus.ACTIVE, passwordHash },
    create: {
      email: TENANT_A_ADMIN_EMAIL,
      passwordHash,
      firstName: "Tenant A",
      lastName: "RLS E2E",
      status: UserStatus.ACTIVE,
    },
  });
  const tenantBAdminUser = await prisma.user.upsert({
    where: { email: TENANT_B_ADMIN_EMAIL },
    update: { status: UserStatus.ACTIVE, passwordHash },
    create: {
      email: TENANT_B_ADMIN_EMAIL,
      passwordHash,
      firstName: "Tenant B",
      lastName: "RLS E2E",
      status: UserStatus.ACTIVE,
    },
  });
  const tenantBTeacherUser = await prisma.user.upsert({
    where: { email: TENANT_B_TEACHER_EMAIL },
    update: { status: UserStatus.ACTIVE, passwordHash },
    create: {
      email: TENANT_B_TEACHER_EMAIL,
      passwordHash,
      firstName: "Profesor B",
      lastName: "RLS E2E",
      status: UserStatus.ACTIVE,
    },
  });

  // Todo lo de acá para abajo escribe/lee tablas con RLS forzado -- ver el
  // mismo comentario en backend-v1.e2e-spec.ts#ensureDemoE2eUsers.
  await tenantRlsContext.runWithTenant(tenantA.id, async () => {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: tenantAAdminUser.id } },
      update: { role: UserRole.TENANT_ADMIN, status: "ACTIVE" },
      create: { tenantId: tenantA.id, userId: tenantAAdminUser.id, role: UserRole.TENANT_ADMIN },
    });
  });

  const { studentId, teacherId, groupId } = await tenantRlsContext.runWithTenant(tenantB.id, async () => {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenantB.id, userId: tenantBAdminUser.id } },
      update: { role: UserRole.TENANT_ADMIN, status: "ACTIVE" },
      create: { tenantId: tenantB.id, userId: tenantBAdminUser.id, role: UserRole.TENANT_ADMIN },
    });
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenantB.id, userId: tenantBTeacherUser.id } },
      update: { role: UserRole.TEACHER, status: "ACTIVE" },
      create: { tenantId: tenantB.id, userId: tenantBTeacherUser.id, role: UserRole.TEACHER },
    });

    const group = await prisma.group.upsert({
      where: { id: await findGroupId(prisma, tenantB.id, "RLS-E2E-B") },
      update: {},
      create: { tenantId: tenantB.id, name: "RLS-E2E-B", grade: "1", section: "B" },
    }).catch(async () =>
      prisma.group.create({
        data: { tenantId: tenantB.id, name: "RLS-E2E-B", grade: "1", section: "B" },
      }),
    );

    const teacher = await prisma.teacher.upsert({
      where: { userId: tenantBTeacherUser.id },
      update: { tenantId: tenantB.id },
      create: { userId: tenantBTeacherUser.id, tenantId: tenantB.id },
    });

    const student = await prisma.student.upsert({
      where: { tenantId_documentId: { tenantId: tenantB.id, documentId: "RLS-E2E-B-STU-1" } },
      update: { groupId: group.id, firstName: "Estudiante" },
      create: {
        tenantId: tenantB.id,
        documentId: "RLS-E2E-B-STU-1",
        firstName: "Estudiante",
        lastName: "Tenant B RLS E2E",
        groupId: group.id,
      },
    });

    return { studentId: student.id, teacherId: teacher.id, groupId: group.id };
  });

  return {
    tenantAId: tenantA.id,
    tenantBId: tenantB.id,
    tenantBStudentId: studentId,
    tenantBTeacherId: teacherId,
    tenantBGroupId: groupId,
  };
}

async function findGroupId(prisma: PrismaService, tenantId: string, name: string) {
  const existing = await prisma.group.findFirst({ where: { tenantId, name } });
  return existing?.id ?? "00000000-0000-0000-0000-000000000000";
}
