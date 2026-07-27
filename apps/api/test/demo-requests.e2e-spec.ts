// Cobertura e2e de /demo-requests: el único módulo del backend con escritura pública.
//
// Lo que se prueba acá no es "el formulario guarda" sino la asimetría que lo hace seguro:
// cualquiera en internet puede CREAR una solicitud (sin JWT y sin x-tenant-slug), y nadie
// puede LEERLA sin ser SUPER_ADMIN. Un bug en cualquiera de las dos mitades es serio en
// direcciones opuestas — si la escritura se cierra, el sitio público deja de convertir; si
// la lectura se abre, quedan expuestos datos de contacto y precios cotizados.
//
// Los tests se verificaron revirtiendo el comportamiento que afirman, como el resto de la
// suite:
//  - Agregando DEMO_REQUESTS_LIST al arreglo de TENANT_ADMIN, el test de 403 falla (pasa a
//    devolver 200).
//  - Sellando `quotedAt` en cada PATCH en vez de solo la primera vez, el test de la segunda
//    cotización falla.
//
// Lo que NO se prueba acá es el rate-limit del POST público. No es un olvido: el throttler
// está apagado en tests a propósito (`skipIf` en app.module.ts, con la razón escrita ahí —
// costaba minutos de CI en backoffs). Un test que lo afirmara tendría que levantar su propio
// módulo con esa línea desactivada.
//
// Archivo aparte porque levanta identidades propias (un SUPER_ADMIN y un TENANT_ADMIN) y no
// necesita nada de los fixtures de calendario.
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { TenantStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";
import { TenantRlsContextService } from "../src/core/prisma/tenant-rls-context.service";

const PASSWORD = "ClassiaDemo2026!";
const TENANT_SLUG = "demo";
const SUPER_ADMIN_EMAIL = "demo-requests-e2e-super-admin@classia.test";
const TENANT_ADMIN_EMAIL = "demo-requests-e2e-tenant-admin@classia.test";

// Marca de esta corrida: la tabla es global y no se limpia entre suites, así que los tests
// filtran por este nombre en vez de asumir que la bandeja está vacía.
const SCHOOL_NAME = "Colegio E2E Solicitudes";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tenant: { id: string; slug: string };
};

type DemoRequestPayload = {
  id: string;
  schoolName: string;
  contactName: string;
  contactEmail: string;
  studentCount: number | null;
  interests: string[];
  status: "NEW" | "CONTACTED" | "QUOTED" | "WON" | "LOST";
  quotedPlan: string | null;
  quotedAmount: number | null;
  quotedCurrency: string | null;
  quotedAt: string | null;
  internalNotes: string | null;
  handledBy: { id: string; email: string } | null;
};

describe("Demo requests (public write, SUPER_ADMIN read)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let superAdminSession: LoginResponse;
  let tenantAdminSession: LoginResponse;
  let createdId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();

    prisma = app.get(PrismaService);
    await ensureFixtures(prisma, app.get(TenantRlsContextService));

    // Solicitudes viejas de corridas anteriores: la tabla no tiene RLS ni se trunca entre
    // suites, así que se limpian las de este nombre para que los conteos sean estables.
    await prisma.demoRequest.deleteMany({ where: { schoolName: SCHOOL_NAME } });

    superAdminSession = await loginAs(SUPER_ADMIN_EMAIL);
    tenantAdminSession = await loginAs(TENANT_ADMIN_EMAIL);
  }, 180_000); // loginAs reintenta con backoff ante el 429 del login

  afterAll(async () => {
    await prisma.demoRequest.deleteMany({ where: { schoolName: SCHOOL_NAME } });
    await app.close();
  });

  async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
  }

  async function loginAs(email: string, attempt = 1): Promise<LoginResponse> {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-slug": TENANT_SLUG },
      body: JSON.stringify({ email, password: PASSWORD, tenantSlug: TENANT_SLUG }),
    });
    if (res.status === 429 && attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
      return loginAs(email, attempt + 1);
    }
    expect(res.status).toBe(201);
    return res.body;
  }

  function authHeaders(accessToken: string): Record<string, string> {
    return { authorization: `Bearer ${accessToken}` };
  }

  function postDemoRequest(body: unknown) {
    return api<unknown>("/demo-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("accepts a request from the public site with no session and no tenant header", async () => {
    // Sin Authorization y sin x-tenant-slug a propósito: así llega desde el sitio público,
    // donde todavía no hay colegio. Si algún día se le cuelga un guard de sesión o de tenant,
    // este test es el que se rompe.
    const res = await postDemoRequest({
      schoolName: SCHOOL_NAME,
      contactName: "María Rodríguez",
      contactEmail: "RECTORIA@colegio-e2e.test",
      contactPhone: "+57 300 000 0000",
      contactRole: "Rector(a)",
      city: "Bogotá",
      studentCount: 450,
      interests: ["CALIFICACIONES", "CARTERA"],
      message: "Llevamos las notas en Excel.",
      source: "registro",
    });

    expect(res.status).toBe(201);
    // Cuerpo vacío: devolver el id le daría a cualquiera un identificador válido de una fila
    // que solo el equipo interno puede leer.
    expect(res.body).toBeUndefined();

    const stored = await prisma.demoRequest.findFirstOrThrow({ where: { schoolName: SCHOOL_NAME } });
    createdId = stored.id;
    expect(stored.status).toBe("NEW");
    expect(stored.studentCount).toBe(450);
    // El email se normaliza en el schema de Zod, no en la base.
    expect(stored.contactEmail).toBe("rectoria@colegio-e2e.test");
    expect(stored.handledById).toBeNull();
  });

  it("rejects a malformed body before touching the database", async () => {
    const res = await postDemoRequest({
      schoolName: "X",
      contactName: "Y",
      contactEmail: "no-es-un-correo",
    });

    expect(res.status).toBe(400);
    expect(await prisma.demoRequest.count({ where: { contactEmail: "no-es-un-correo" } })).toBe(0);
  });

  it("requires a session to read the inbox", async () => {
    const res = await api<unknown>("/demo-requests");
    expect(res.status).toBe(401);
  });

  it("hides the inbox from a TENANT_ADMIN — it is platform data, not the school's", async () => {
    const res = await api<unknown>("/demo-requests", {
      headers: authHeaders(tenantAdminSession.accessToken),
    });
    expect(res.status).toBe(403);
  });

  it("lets a SUPER_ADMIN read the request that came in from the public form", async () => {
    const res = await api<DemoRequestPayload[]>("/demo-requests", {
      headers: authHeaders(superAdminSession.accessToken),
    });

    expect(res.status).toBe(200);
    const found = res.body.find((request) => request.id === createdId);
    expect(found).toBeDefined();
    expect(found?.schoolName).toBe(SCHOOL_NAME);
    expect(found?.interests).toEqual(["CALIFICACIONES", "CARTERA"]);
  });

  it("records the quote, stamps quotedAt once and audits the change without a tenant", async () => {
    const res = await api<DemoRequestPayload>(`/demo-requests/${createdId}`, {
      method: "PATCH",
      headers: { ...authHeaders(superAdminSession.accessToken), "content-type": "application/json" },
      body: JSON.stringify({
        status: "QUOTED",
        quotedPlan: "Profesional",
        quotedAmount: 599,
        quotedCurrency: "usd",
        internalNotes: "Pidió migrar el año pasado.",
      }),
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("QUOTED");
    // Decimal convertido a número en el borde HTTP: si volviera como string ("599"), el
    // frontend tendría que parsearlo.
    expect(res.body.quotedAmount).toBe(599);
    expect(res.body.quotedCurrency).toBe("USD");
    expect(res.body.quotedAt).not.toBeNull();
    // Quién la atiende sale de quién edita, no de un campo del cuerpo.
    expect(res.body.handledBy?.email).toBe(SUPER_ADMIN_EMAIL);

    const firstQuotedAt = res.body.quotedAt;

    const second = await api<DemoRequestPayload>(`/demo-requests/${createdId}`, {
      method: "PATCH",
      headers: { ...authHeaders(superAdminSession.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ status: "WON", quotedAmount: 650 }),
    });

    expect(second.status).toBe(200);
    // quotedAt es "cuándo se cotizó", no "cuándo se tocó la fila": no se vuelve a mover.
    expect(second.body.quotedAt).toBe(firstQuotedAt);

    // La acción no ocurre dentro de ningún colegio, así que el registro de auditoría queda
    // con tenantId nulo (política nullable-tenant de audit_logs).
    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityType: "DemoRequest", entityId: createdId },
      orderBy: { createdAt: "desc" },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.action).toBe("demo_request.updated");
    expect(auditEntry?.tenantId).toBeNull();
  });

});

async function ensureFixtures(prisma: PrismaService, tenantRlsContext: TenantRlsContextService) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // tenants/users son globales (sin RLS): estos upserts corren sin contexto de tenant.
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: {
      slug: TENANT_SLUG,
      name: "Colegio Demo Classia",
      primaryDomain: "app.demo.classia.com.co",
      status: TenantStatus.DEMO,
      brandColor: "#2563eb",
    },
  });

  const superAdminUser = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: { status: UserStatus.ACTIVE, passwordHash },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      firstName: "Super Admin",
      lastName: "Demo Requests E2E",
      status: UserStatus.ACTIVE,
    },
  });

  const tenantAdminUser = await prisma.user.upsert({
    where: { email: TENANT_ADMIN_EMAIL },
    update: { status: UserStatus.ACTIVE, passwordHash },
    create: {
      email: TENANT_ADMIN_EMAIL,
      passwordHash,
      firstName: "Admin",
      lastName: "Demo Requests E2E",
      status: UserStatus.ACTIVE,
    },
  });

  // tenant_memberships sí tiene RLS forzado: va dentro del contexto del tenant.
  await tenantRlsContext.runWithTenant(tenant.id, async () => {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: superAdminUser.id } },
      update: { role: UserRole.SUPER_ADMIN, status: "ACTIVE" },
      create: { tenantId: tenant.id, userId: superAdminUser.id, role: UserRole.SUPER_ADMIN },
    });
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: tenantAdminUser.id } },
      update: { role: UserRole.TENANT_ADMIN, status: "ACTIVE" },
      create: { tenantId: tenant.id, userId: tenantAdminUser.id, role: UserRole.TENANT_ADMIN },
    });
  });
}
