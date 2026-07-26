// Agregación multi-fuente del calendario (docs/planning/calendario.md, Fase 3).
//
// §7.3 llama a esta fase "el riesgo de seguridad número uno del plan": un endpoint que junta
// seis módulos es un punto único donde una consulta mal filtrada expone notas, deudas o datos
// de otra familia. Esta suite existe sobre todo para eso — la mitad de los tests son de fuga,
// no de funcionalidad.
//
// El caso crítico es cartera. `PaymentsService#listInvoices` filtra SOLO por tenant porque su
// ruta exige PAYMENTS_MANAGE; si la agregación lo llamara para un acudiente, listaría las
// facturas de todas las familias del colegio. Por eso el fixture tiene dos estudiantes en el
// MISMO grupo, uno del acudiente y otro no: un filtro por grupo pasaría los tests de un filtro
// por acudiente si el otro estudiante estuviera en otro grupo.
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CalendarEventType, ElectionStatus, InvoiceStatus } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";
import { TenantRlsContextService } from "../src/core/prisma/tenant-rls-context.service";
import {
  ADMIN_A_EMAIL,
  type Fixtures,
  GUARDIAN_EMAIL,
  PASSWORD,
  STUDENT_EMAIL,
  TEACHER_1_EMAIL,
  TENANT_A_SLUG,
  ensureFixtures,
} from "./helpers/calendar-fixtures";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tenant: { id: string; slug: string };
};

type CalendarItem = {
  id: string;
  source: "event" | "homework" | "period" | "invoice" | "election" | "schedule";
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  editable: boolean;
  href: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function inDays(days: number, hourUtc = 14): Date {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}

const RANGE_FROM = new Date(Date.now() - 30 * DAY_MS).toISOString();
const RANGE_TO = new Date(Date.now() + 120 * DAY_MS).toISOString();

describe("Calendario agregado", () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let rls: TenantRlsContextService;
  let fixtures: Fixtures;

  let adminA: LoginResponse;
  let guardian: LoginResponse;
  let teacher: LoginResponse;
  let student: LoginResponse;

  const createdEventIds: string[] = [];
  const createdHomeworkIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdElectionIds: string[] = [];

  let ownInvoiceId: string;
  let otherFamilyInvoiceId: string;

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
    teacher = await loginAs(TEACHER_1_EMAIL, TENANT_A_SLUG);
    student = await loginAs(STUDENT_EMAIL, TENANT_A_SLUG);

    await rls.runWithTenant(fixtures.tenantAId, async () => {
      const event = await prisma.event.create({
        data: {
          tenantId: fixtures.tenantAId,
          title: "Festival agregado",
          type: CalendarEventType.INSTITUCIONAL,
          startsAt: inDays(3),
          endsAt: inDays(3, 16),
        },
        select: { id: true },
      });
      createdEventIds.push(event.id);

      const homework = await prisma.homework.create({
        data: {
          tenantId: fixtures.tenantAId,
          teacherId: fixtures.teacher1Id,
          subjectId: fixtures.subjectId,
          groupId: fixtures.groupOneId,
          academicYearId: fixtures.academicYearId,
          title: "Ensayo de agregación",
          dueDate: inDays(4, 23),
          status: "ACTIVE",
        },
        select: { id: true },
      });
      createdHomeworkIds.push(homework.id);

      // Dos facturas del MISMO grupo: una del hijo del acudiente y otra de una familia ajena.
      const own = await prisma.invoice.create({
        data: {
          tenantId: fixtures.tenantAId,
          studentId: fixtures.studentId,
          academicYearId: fixtures.academicYearId,
          concept: "Pensión propia",
          amount: 500000,
          dueDate: inDays(6),
          status: InvoiceStatus.PENDING,
        },
        select: { id: true },
      });
      const other = await prisma.invoice.create({
        data: {
          tenantId: fixtures.tenantAId,
          studentId: fixtures.otherStudentId,
          academicYearId: fixtures.academicYearId,
          concept: "Pension de otra familia",
          amount: 700000,
          dueDate: inDays(6),
          status: InvoiceStatus.PENDING,
        },
        select: { id: true },
      });
      ownInvoiceId = own.id;
      otherFamilyInvoiceId = other.id;
      createdInvoiceIds.push(own.id, other.id);

      const published = await prisma.election.create({
        data: {
          tenantId: fixtures.tenantAId,
          title: "Personero agregado",
          startDate: inDays(8),
          endDate: inDays(8, 20),
          status: ElectionStatus.ACTIVE,
          createdById: fixtures.teacher1UserId,
        },
        select: { id: true },
      });
      const draft = await prisma.election.create({
        data: {
          tenantId: fixtures.tenantAId,
          title: "Eleccion en borrador",
          startDate: inDays(9),
          endDate: inDays(9, 20),
          status: ElectionStatus.DRAFT,
          createdById: fixtures.teacher1UserId,
        },
        select: { id: true },
      });
      createdElectionIds.push(published.id, draft.id);
    });
  }, 180_000);

  afterAll(async () => {
    await rls.runWithTenant(fixtures.tenantAId, async () => {
      await prisma.election.deleteMany({ where: { id: { in: createdElectionIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
      await prisma.homework.deleteMany({ where: { id: { in: createdHomeworkIds } } });
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    });
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

  function headers(session: LoginResponse): Record<string, string> {
    return {
      authorization: `Bearer ${session.accessToken}`,
      "x-tenant-slug": session.tenant.slug,
    };
  }

  async function calendar(session: LoginResponse, sources?: string) {
    const query = `from=${encodeURIComponent(RANGE_FROM)}&to=${encodeURIComponent(RANGE_TO)}${
      sources ? `&sources=${sources}` : ""
    }`;
    const res = await api<CalendarItem[]>(`/calendar?${query}`, { headers: headers(session) });
    expect(res.status).toBe(200);
    return res.body;
  }

  const idsOf = (items: CalendarItem[], source: string) =>
    items.filter((item) => item.source === source).map((item) => item.sourceId);

  // ─── Fuga de cartera: el caso crítico de §7.3 ───────────────────────────────

  // Reversión verificada: cambiando invoiceItems() para que llame a
  // `payments.listInvoices(actor, {})` también en la rama del acudiente —el atajo natural, y
  // el que §7.3 marca como el error— este test falla: aparece la factura de la otra familia.
  it("un acudiente ve la factura de su hijo y NUNCA la de otra familia del mismo grupo", async () => {
    const items = await calendar(guardian, "invoice");
    const invoiceIds = idsOf(items, "invoice");

    expect(invoiceIds).toContain(ownInvoiceId);
    expect(invoiceIds).not.toContain(otherFamilyInvoiceId);
  });

  it("no filtra el monto de la factura en el ítem del calendario", async () => {
    const items = await calendar(guardian, "invoice");
    const serialized = JSON.stringify(items);
    expect(serialized).not.toContain("500000");
    expect(serialized).not.toContain("700000");
  });

  it("la administración sí ve la cartera del colegio", async () => {
    const invoiceIds = idsOf(await calendar(adminA, "invoice"), "invoice");
    expect(invoiceIds).toEqual(expect.arrayContaining([ownInvoiceId, otherFamilyInvoiceId]));
  });

  // Reversión verificada: quitando la guarda `if (!this.can(actor, PAYMENTS_READ_SELF))` y la
  // de PAYMENTS_MANAGE, este test falla — el profesor recibe la cartera del colegio entero.
  it("un profesor no ve NINGUNA factura", async () => {
    const items = await calendar(teacher, "invoice");
    expect(idsOf(items, "invoice")).toHaveLength(0);
  });

  // ─── Las otras fuentes ──────────────────────────────────────────────────────

  it("junta eventos, entregas, periodos y elecciones en una sola respuesta", async () => {
    const items = await calendar(adminA);
    const sources = new Set(items.map((item) => item.source));

    expect(sources.has("event")).toBe(true);
    expect(sources.has("homework")).toBe(true);
    expect(sources.has("election")).toBe(true);
    expect(idsOf(items, "event")).toContain(createdEventIds[0]);
    expect(idsOf(items, "homework")).toContain(createdHomeworkIds[0]);
  });

  it("devuelve todo ordenado por fecha de inicio", async () => {
    const items = await calendar(adminA);
    const times = items.map((item) => new Date(item.startsAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  // Reversión verificada: quitando el `editable: false` de las fuentes derivadas (poniéndolo en
  // true), este test falla. Es la regla de §2.D: el calendario muestra, no edita.
  it("solo los eventos son editables; todo lo derivado es de solo lectura", async () => {
    const items = await calendar(adminA);
    for (const item of items) {
      expect(item.editable).toBe(item.source === "event");
      expect(item.href).toBeTruthy();
    }
  });

  it("el parámetro sources es opt-in y acota lo que se consulta", async () => {
    const items = await calendar(adminA, "event");
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((item) => item.source))).toEqual(new Set(["event"]));
  });

  it("las clases no vienen por defecto y sí cuando se piden", async () => {
    const porDefecto = await calendar(adminA);
    expect(idsOf(porDefecto, "schedule")).toHaveLength(0);

    const conClases = await calendar(adminA, "schedule");
    expect(conClases.length).toBeGreaterThan(0);
    expect(new Set(conClases.map((i) => i.source))).toEqual(new Set(["schedule"]));
  });

  // Una elección en borrador no se anunció: mostrarla en el calendario de los estudiantes
  // filtra una decisión que todavía no se tomó.
  //
  // Reversión verificada: quitando el filtro `election.status !== DRAFT`, este test falla.
  it("el borrador de una elección solo lo ve quien la administra", async () => {
    const adminIds = idsOf(await calendar(adminA, "election"), "election");
    expect(adminIds).toEqual(expect.arrayContaining(createdElectionIds));

    // El estudiante es quien vota, así que sí ve la publicada — y por eso su ausencia del
    // borrador significa algo. Sin este caso el test no probaría el filtro: el profesor no
    // tiene permisos de elecciones y recibe una lista vacía antes de llegar a él.
    const studentIds = idsOf(await calendar(student, "election"), "election");
    expect(studentIds).toContain(createdElectionIds[0]); // la ACTIVE
    expect(studentIds).not.toContain(createdElectionIds[1]); // la DRAFT
  });

  it("un profesor no ve elecciones: no las administra ni vota", async () => {
    expect(idsOf(await calendar(teacher, "election"), "election")).toHaveLength(0);
  });

  // El acudiente hereda el scoping de HomeworkService: las tareas del grupo de su hijo.
  it("el acudiente ve las entregas del grupo de su hijo", async () => {
    const items = await calendar(guardian, "homework");
    expect(idsOf(items, "homework")).toContain(createdHomeworkIds[0]);
  });

  // ─── Contrato ───────────────────────────────────────────────────────────────

  it("rechaza un rango mayor a 400 días", async () => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 500 * DAY_MS).toISOString();
    const res = await api<unknown>(
      `/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: headers(adminA) },
    );
    expect(res.status).toBe(400);
  });

  it("rechaza una fuente que no existe", async () => {
    const res = await api<unknown>(
      `/calendar?from=${encodeURIComponent(RANGE_FROM)}&to=${encodeURIComponent(RANGE_TO)}&sources=notas`,
      { headers: headers(adminA) },
    );
    expect(res.status).toBe(400);
  });

  it("cada ítem trae un id único compuesto por fuente y origen", async () => {
    const items = await calendar(adminA);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of items) {
      expect(item.id.startsWith(`${item.source}:`)).toBe(true);
    }
  });
});
