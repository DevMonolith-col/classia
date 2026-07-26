// Feed ICS suscribible (docs/planning/calendario.md, Fase 5).
//
// §7.7 lo llama "el caso más delicado del plan entero" y por eso tiene suite propia: es el
// único endpoint del repo que corre **sin JWT y sin `x-tenant-slug`**, así que
// TenantRlsContextInterceptor no setea nada y sin `runWithTenant` explícito el feed devolvería
// un calendario vacío — con 200, sin error y sin nada en los logs.
//
// El primer test de acá es exactamente esa trampa. Verificado quitándole el `runWithTenant` al
// servicio: el test falla porque el feed sale sin un solo VEVENT.
//
// Los fetch de este archivo NO llevan Authorization ni x-tenant-slug a propósito. Si algún
// test empieza a mandarlos, deja de probar lo que cree.
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CalendarEventType, UserRole } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";
import { TenantRlsContextService } from "../src/core/prisma/tenant-rls-context.service";
import {
  ADMIN_A_EMAIL,
  ADMIN_B_EMAIL,
  type Fixtures,
  GUARDIAN_EMAIL,
  PASSWORD,
  TEACHER_1_EMAIL,
  TENANT_A_SLUG,
  TENANT_B_SLUG,
  ensureFixtures,
} from "./helpers/calendar-fixtures";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tenant: { id: string; slug: string };
};

type TokenResponse = {
  feedUrl: string;
  webcalUrl: string;
  qrDataUrl: string;
  createdAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fechas relativas a hoy: la ventana del feed es -90/+365 días, no un año fijo. */
function inDays(days: number, hourUtc = 14): Date {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}

describe("Feed ICS del calendario", () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let rls: TenantRlsContextService;
  let fixtures: Fixtures;

  let adminA: LoginResponse;
  let guardian: LoginResponse;
  let adminB: LoginResponse;

  const createdEventIds: string[] = [];
  const createdHomeworkIds: string[] = [];

  // Tokens emitidos una vez y reusados por los tests de lectura: emitir uno por test agota el
  // rate-limit del endpoint sin probar nada nuevo. Los tests de ciclo de vida sí emiten
  // propios, porque necesitan uno recién nacido.
  let adminAFeed: TokenResponse;
  let guardianFeed: TokenResponse;
  let adminBFeed: TokenResponse;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();

    prisma = app.get(PrismaService);
    rls = app.get(TenantRlsContextService);
    fixtures = await ensureFixtures(prisma, rls);

    adminA = await loginAs(ADMIN_A_EMAIL, TENANT_A_SLUG);
    guardian = await loginAs(GUARDIAN_EMAIL, TENANT_A_SLUG);
    adminB = await loginAs(ADMIN_B_EMAIL, TENANT_B_SLUG);

    await createEvent(adminA, {
      title: "Festival cultural del feed",
      type: CalendarEventType.INSTITUCIONAL,
      startsAt: inDays(5).toISOString(),
      endsAt: inDays(5, 16).toISOString(),
      location: "Coliseo",
    });

    await createEvent(adminA, {
      title: "Consejo académico reservado",
      type: CalendarEventType.REUNION,
      startsAt: inDays(6).toISOString(),
      endsAt: inDays(6, 16).toISOString(),
      targetRole: UserRole.TEACHER,
    });

    await createEvent(adminA, {
      title: "Salida del grupo dos",
      startsAt: inDays(7).toISOString(),
      endsAt: inDays(7, 16).toISOString(),
      groupId: fixtures.groupTwoId,
    });

    // Tarea del grupo del hijo del acudiente — §9.6: el feed incluye las entregas del alumno.
    const homework = await rls.runWithTenant(fixtures.tenantAId, () =>
      prisma.homework.create({
        data: {
          tenantId: fixtures.tenantAId,
          teacherId: fixtures.teacher1Id,
          subjectId: fixtures.subjectId,
          groupId: fixtures.groupOneId,
          title: "Taller de fracciones",
          dueDate: inDays(10, 23),
          status: "ACTIVE",
        },
        select: { id: true },
      }),
    );
    createdHomeworkIds.push(homework.id);

    adminAFeed = await issueToken(adminA);
    guardianFeed = await issueToken(guardian);
    adminBFeed = await issueToken(adminB);
  }, 180_000);

  afterAll(async () => {
    await rls.runWithTenant(fixtures.tenantAId, async () => {
      await prisma.homework.deleteMany({ where: { id: { in: createdHomeworkIds } } });
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
      await prisma.calendarFeedToken.deleteMany({ where: { tenantId: fixtures.tenantAId } });
    });
    await rls.runWithTenant(fixtures.tenantBId, () =>
      prisma.calendarFeedToken.deleteMany({ where: { tenantId: fixtures.tenantBId } }),
    );
    await app.close();
  });

  async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
  }

  async function loginAs(email: string, tenantSlug: string, attempt = 1): Promise<LoginResponse> {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ email, password: PASSWORD, tenantSlug }),
    });
    if (res.status === 429 && attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
      return loginAs(email, tenantSlug, attempt + 1);
    }
    expect(res.status).toBe(201);
    return res.body;
  }

  function headers(session: LoginResponse, json = false): Record<string, string> {
    return {
      authorization: `Bearer ${session.accessToken}`,
      "x-tenant-slug": session.tenant.slug,
      ...(json ? { "content-type": "application/json" } : {}),
    };
  }

  async function createEvent(session: LoginResponse, body: Record<string, unknown>) {
    const res = await api<{ id: string }>("/events", {
      method: "POST",
      headers: headers(session, true),
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    createdEventIds.push(res.body.id);
    return res.body;
  }

  // POST /calendar/feed/token está limitado a 5/min a propósito: cada llamada revoca la
  // suscripción anterior, así que un bucle deja a alguien sin calendario sin que se entere.
  // Esta suite lo agota sola, igual que los e2e agotan el rate-limit del login — se reintenta
  // con backoff en vez de subirle el límite al endpoint para que los tests sean cómodos.
  async function issueToken(session: LoginResponse, attempt = 1): Promise<TokenResponse> {
    const res = await api<TokenResponse>("/calendar/feed/token", {
      method: "POST",
      headers: headers(session),
    });
    if (res.status === 429 && attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
      return issueToken(session, attempt + 1);
    }
    expect(res.status).toBe(201);
    return res.body;
  }

  /** Descarga el feed como lo haría Google Calendar: sin sesión y sin header de tenant. */
  async function fetchFeed(feedUrl: string) {
    const path = new URL(feedUrl).pathname;
    const response = await fetch(`${baseUrl}${path}`);
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: await response.text(),
    };
  }

  /** Deshace el plegado y devuelve los SUMMARY del calendario. */
  function summaries(ics: string): string[] {
    return ics
      .replace(/\r\n /g, "")
      .split("\r\n")
      .filter((line) => line.startsWith("SUMMARY:"))
      .map((line) => line.slice("SUMMARY:".length));
  }

  // ─── La trampa de §7.7 ──────────────────────────────────────────────────────

  // Reversión verificada: reemplazando el `tenantRlsContext.runWithTenant(token.tenantId, ...)`
  // de renderFeed por una llamada directa al callback, este test falla — el feed responde 200
  // con un VCALENDAR sin un solo VEVENT. Es exactamente el modo de falla que §7.7 describe:
  // no un error, un calendario vacío.
  it("devuelve eventos de verdad corriendo sin JWT y sin x-tenant-slug", async () => {
    const feed = await fetchFeed(adminAFeed.feedUrl);

    expect(feed.status).toBe(200);
    expect(feed.body).toContain("BEGIN:VCALENDAR");
    expect(feed.body.split("BEGIN:VEVENT").length - 1).toBeGreaterThan(0);
    expect(summaries(feed.body)).toContain("Festival cultural del feed");
  });

  it("responde con content-type de calendario", async () => {
    const feed = await fetchFeed(adminAFeed.feedUrl);
    expect(feed.contentType).toContain("text/calendar");
  });

  // ─── Audiencia ──────────────────────────────────────────────────────────────

  // Reversión verificada: si eventItems() consultara Prisma directo en vez de delegar a
  // EventsService (o sea, si el feed reimplementara la audiencia), este test falla — el
  // acudiente recibe el evento reservado a profesores.
  it("respeta la audiencia del dueño del token", async () => {
    const feed = await fetchFeed(guardianFeed.feedUrl);
    const titles = summaries(feed.body);

    expect(titles).toContain("Festival cultural del feed"); // todo el colegio
    expect(titles).not.toContain("Consejo académico reservado"); // solo profesores
    expect(titles).not.toContain("Salida del grupo dos"); // grupo ajeno
  });

  it("el feed del admin sí incluye lo reservado a profesores", async () => {
    const titles = summaries((await fetchFeed(adminAFeed.feedUrl)).body);
    expect(titles).toContain("Consejo académico reservado");
  });

  // ─── Entregas de tareas (§9.6) ──────────────────────────────────────────────

  it("incluye las entregas del hijo en el feed del acudiente, con título y materia", async () => {
    const titles = summaries((await fetchFeed(guardianFeed.feedUrl)).body);
    expect(titles).toContain("Entrega: Taller de fracciones (EVENTS-E2E-MAT)");
  });

  // Ojo con este test: **no prueba el filtro por rol**, aunque lo parezca. Se verificó
  // quitándole a homeworkItems() el `if (role !== STUDENT && role !== GUARDIAN)` y sigue
  // pasando, porque un TENANT_ADMIN no tiene grupos y `resolveUserGroupIds` ya devuelve vacío.
  // Vale como aserción del resultado; el que ejercita la guarda es el siguiente.
  it("no incluye entregas en el feed de la administración", async () => {
    const titles = summaries((await fetchFeed(adminAFeed.feedUrl)).body);
    expect(titles.some((t) => t.startsWith("Entrega:"))).toBe(false);
  });

  // Este sí: un profesor **tiene** grupos, así que sin el filtro por rol su feed se llenaría
  // con las entregas de todos sus cursos y el calendario quedaría inútil. §9.6 habla de las
  // entregas *del alumno*.
  //
  // Reversión verificada: quitando la guarda por rol de homeworkItems(), este test falla —
  // aparece "Entrega: Taller de fracciones" en el feed del profesor.
  it("no incluye entregas en el feed del profesor", async () => {
    const teacher = await loginAs(TEACHER_1_EMAIL, TENANT_A_SLUG);
    const teacherFeed = await issueToken(teacher);
    const titles = summaries((await fetchFeed(teacherFeed.feedUrl)).body);

    // Prueba de que el feed del profesor no está vacío por otra razón: ve lo suyo.
    expect(titles).toContain("Consejo académico reservado");
    expect(titles.some((t) => t.startsWith("Entrega:"))).toBe(false);
  });

  // La URL viaja en claro y queda en los logs del cliente: el SUMMARY no puede llevar nada
  // más que qué y cuándo.
  it("no filtra notas, montos ni estado de entrega", async () => {
    const body = (await fetchFeed(guardianFeed.feedUrl)).body;
    expect(body).not.toMatch(/nota|calificaci|promedio|saldo|factura|deuda|\$\s?\d/i);
  });

  // ─── Aislamiento entre colegios ─────────────────────────────────────────────

  // El token del colegio B se resuelve con el rol de bypass (es el único lookup que puede),
  // así que este test comprueba que el `runWithTenant` posterior usa el tenant DEL TOKEN y no
  // deja pasar los eventos del colegio A.
  //
  // Reversión verificada: cambiando `runWithTenant(token.tenantId, ...)` por
  // `runWithTenant(<tenant A fijo>, ...)` este test falla.
  it("el feed de un colegio no muestra eventos de otro", async () => {
    const titles = summaries((await fetchFeed(adminBFeed.feedUrl)).body);

    expect(titles).not.toContain("Festival cultural del feed");
    expect(titles).not.toContain("Consejo académico reservado");
    // Y sí ve el suyo.
    expect(titles).toContain("Evento privado del colegio B");
  });

  // ─── Ciclo de vida del token ────────────────────────────────────────────────

  it("un token revocado devuelve 404", async () => {
    const token = await issueToken(adminA);
    expect((await fetchFeed(token.feedUrl)).status).toBe(200);

    const revoked = await api<{ revoked: number }>("/calendar/feed/token", {
      method: "DELETE",
      headers: headers(adminA),
    });
    expect(revoked.status).toBe(200);
    expect(revoked.body.revoked).toBeGreaterThan(0);

    expect((await fetchFeed(token.feedUrl)).status).toBe(404);
  });

  it("un token inexistente devuelve 404 y no distingue del revocado", async () => {
    const feed = await fetchFeed(`http://x/calendar/feed/${"a".repeat(43)}.ics`);
    expect(feed.status).toBe(404);
  });

  // Regenerar es la única forma de recuperar la URL, y tiene que invalidar la anterior: si no,
  // una URL filtrada seguiría viva después de "regenerar".
  it("regenerar invalida el token anterior", async () => {
    const first = await issueToken(adminA);
    expect((await fetchFeed(first.feedUrl)).status).toBe(200);

    const second = await issueToken(adminA);
    expect(second.feedUrl).not.toBe(first.feedUrl);

    expect((await fetchFeed(first.feedUrl)).status).toBe(404);
    expect((await fetchFeed(second.feedUrl)).status).toBe(200);
  });

  it("nunca guarda el token en claro", async () => {
    const token = await issueToken(adminA);
    const raw = new URL(token.feedUrl).pathname.split("/").pop()!.replace(/\.ics$/, "");

    const rows = await rls.runWithTenant(fixtures.tenantAId, () =>
      prisma.calendarFeedToken.findMany({
        where: { tenantId: fixtures.tenantAId },
        select: { tokenHash: true },
      }),
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.tokenHash !== raw)).toBe(true);
    // sha256 hex: 64 caracteres.
    expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.tokenHash))).toBe(true);
  });

  it("registra el uso en lastUsedAt", async () => {
    const token = await issueToken(adminA);

    const before = await api<{ lastUsedAt: string | null }>("/calendar/feed/token", {
      headers: headers(adminA),
    });
    expect(before.body.lastUsedAt).toBeNull();

    await fetchFeed(token.feedUrl);

    const after = await api<{ active: boolean; lastUsedAt: string | null }>("/calendar/feed/token", {
      headers: headers(adminA),
    });
    expect(after.body.active).toBe(true);
    expect(after.body.lastUsedAt).not.toBeNull();
  });

  it("expone la URL webcal y un QR al emitir el token", () => {
    expect(adminAFeed.webcalUrl.startsWith("webcal://")).toBe(true);
    expect(adminAFeed.feedUrl.endsWith(".ics")).toBe(true);
    expect(adminAFeed.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
