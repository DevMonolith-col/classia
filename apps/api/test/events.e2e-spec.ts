// Cobertura e2e del módulo de calendario (docs/planning/calendario.md, Fase 1).
//
// Antes de este archivo el módulo `events` tenía CERO tests: los hits de "event" en
// backend-v1.e2e-spec.ts son `NotificationEventType`, no este módulo.
//
// Cada test se escribió y después se verificó **revirtiendo el comportamiento que afirma**
// para comprobar que falla. Un test de aislamiento que pasa igual con el filtro de tenant
// quitado no prueba nada, y en la sesión del 2026-07-26 ese chequeo destapó que un test de
// notificación no estaba ejercitando el camino que creía. Lo que se revirtió y qué falló
// está anotado en cada bloque.
//
// Archivo aparte de backend-v1.e2e-spec.ts porque levanta su propio tenant B y sus propias
// identidades (dos profesores de grupos distintos, un acudiente), igual que
// rls-cross-tenant.e2e-spec.ts.
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CalendarEventType, UserRole } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";
import { TenantRlsContextService } from "../src/core/prisma/tenant-rls-context.service";
import {
  ADMIN_A_EMAIL,
  type Fixtures,
  GUARDIAN_EMAIL,
  PASSWORD,
  TEACHER_1_EMAIL,
  TEACHER_2_EMAIL,
  TENANT_A_SLUG,
  ensureFixtures,
} from "./helpers/calendar-fixtures";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tenant: { id: string; slug: string };
};

type EventPayload = {
  id: string;
  tenantId: string;
  title: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  targetRole: UserRole | null;
  groupId: string | null;
  isSchoolDayOff: boolean;
  reminderMinutesBefore: number | null;
  createdById: string | null;
};

// Ventana de consulta que cubre todos los eventos que crean los tests.
const RANGE_FROM = "2026-01-01T00:00:00.000Z";
const RANGE_TO = "2026-12-31T23:59:59.000Z";

describe("Calendario (events)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let rls: TenantRlsContextService;
  let fixtures: Fixtures;

  // Un login por identidad, no por test: /auth/login tiene rate-limit a propósito
  // (20/min por IP) y los e2e en ráfaga pegan contra él.
  let adminA: LoginResponse;
  let teacher1: LoginResponse;
  let teacher2: LoginResponse;
  let guardian: LoginResponse;

  // Eventos creados en beforeAll y compartidos por los tests de lectura.
  const createdIds: string[] = [];

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
    teacher1 = await loginAs(TEACHER_1_EMAIL, TENANT_A_SLUG);
    teacher2 = await loginAs(TEACHER_2_EMAIL, TENANT_A_SLUG);
    guardian = await loginAs(GUARDIAN_EMAIL, TENANT_A_SLUG);
  }, 180_000);

  afterAll(async () => {
    await rls.runWithTenant(fixtures.tenantAId, () =>
      prisma.event.deleteMany({ where: { id: { in: createdIds } } }),
    );
    await app.close();
  });

  // Una lectura directa a Prisma desde el test corre SIN contexto de tenant, y con RLS
  // forzado eso no da error: devuelve cero filas. Las aserciones que van contra la base
  // (no contra el API) tienen que envolverse acá o pasan a ser `expect(null)...` y afirman
  // lo contrario de lo que creen. Es la primera causa de la lista de "devuelve cero filas"
  // del skill rls-multitenant, y esta suite la pisó en tres tests antes de esto.
  function inTenant<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return rls.runWithTenant(tenantId, work);
  }

  // Una AttendanceSession nace con un AttendanceRecord por estudiante activo del grupo, así
  // que borrarla directo viola attendance_records_sessionId_fkey. Los hijos primero.
  function deleteAttendanceSession(sessionId: string) {
    return inTenant(fixtures.tenantAId, async () => {
      await prisma.attendanceRecord.deleteMany({ where: { sessionId } });
      await prisma.attendanceSession.deleteMany({ where: { id: sessionId } });
    });
  }

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

  async function createEvent(
    session: LoginResponse,
    body: Record<string, unknown>,
  ): Promise<{ status: number; body: EventPayload }> {
    const res = await api<EventPayload>("/events", {
      method: "POST",
      headers: headers(session, true),
      body: JSON.stringify(body),
    });
    if (res.status === 201 && res.body?.id) createdIds.push(res.body.id);
    return res;
  }

  function listRange(session: LoginResponse, from = RANGE_FROM, to = RANGE_TO) {
    return api<EventPayload[]>(`/events?from=${from}&to=${to}`, { headers: headers(session) });
  }

  // ─── Rango de consulta ──────────────────────────────────────────────────────

  describe("rango", () => {
    // Reversión verificada: devolviendo `startsAt: { gte: query.from ?? new Date() }`
    // (el comportamiento que tenía el servicio antes de la Fase 1), este test falla —
    // el evento del pasado desaparece de la respuesta.
    it("devuelve eventos pasados, que el servicio anterior escondía", async () => {
      const past = await createEvent(adminA, {
        title: "Evento del pasado",
        type: CalendarEventType.ACADEMICO,
        startsAt: "2026-02-03T14:00:00.000Z",
        endsAt: "2026-02-03T16:00:00.000Z",
      });
      expect(past.status).toBe(201);

      const res = await listRange(adminA, "2026-01-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z");
      expect(res.status).toBe(200);
      expect(res.body.map((e) => e.id)).toContain(past.body.id);
    });

    // Reversión verificada: quitando el `lte: query.to` del filtro, este test falla —
    // el evento de diciembre entra en una ventana que termina en marzo.
    it("excluye lo que cae fuera de la ventana", async () => {
      const outside = await createEvent(adminA, {
        title: "Evento fuera de rango",
        startsAt: "2026-12-15T14:00:00.000Z",
        endsAt: "2026-12-15T16:00:00.000Z",
      });
      expect(outside.status).toBe(201);

      const res = await listRange(adminA, "2026-01-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z");
      expect(res.body.map((e) => e.id)).not.toContain(outside.body.id);
    });

    it("rechaza una ventana mayor a 400 días", async () => {
      const res = await api<unknown>("/events?from=2026-01-01T00:00:00.000Z&to=2027-12-31T00:00:00.000Z", {
        headers: headers(adminA),
      });
      expect(res.status).toBe(400);
    });

    it("rechaza 'to' sin 'from'", async () => {
      const res = await api<unknown>("/events?to=2026-03-01T00:00:00.000Z", {
        headers: headers(adminA),
      });
      expect(res.status).toBe(400);
    });

    // El dashboard de admin ya llamaba /events?limit=4 antes de este cambio
    // (apps/web/app/admin/page.tsx). Si el modo "próximos" se rompe, esa pantalla
    // devuelve 400 en producción y nada más lo avisa.
    it("mantiene el modo 'próximos' con limit y sin rango", async () => {
      const res = await api<EventPayload[]>("/events?limit=4", { headers: headers(adminA) });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(4);
    });
  });

  // ─── Aislamiento entre tenants ──────────────────────────────────────────────

  // ⚠️ Los dos primeros tests de este bloque **siguen pasando** si se le quita el filtro de
  // tenant al servicio. Se comprobó revirtiéndolo: `...(scopedTenantId ? { tenantId } : {})`
  // fuera de `list()` y de `findOne()`, y los dos pasan igual.
  //
  // No es que los tests estén mal: es que con RLS forzado el filtro de la aplicación **no es
  // observable desde el API**. La conexión lleva `app.tenant_id` del tenant del request, así
  // que las filas del tenant B no existen para esa consulta, con `WHERE tenantId` o sin él.
  // Postgres tapa el error antes de que el `WHERE` importe.
  //
  // Consecuencia práctica, que conviene tener clara antes de escribir el próximo test de
  // aislamiento en este repo: **un e2e de aislamiento cross-tenant prueba que RLS está activo,
  // no que el código filtra.** Sirve como regresión de la garantía —si alguien desactiva la
  // política o la app se conecta con el rol superuser, estos tests se ponen rojos— y eso vale.
  // Pero el filtro del servicio queda cubierto solo como defensa en profundidad, para un
  // camino futuro que lea con contexto de tenant ajeno o con el rol BYPASSRLS.
  //
  // Lo que **sí** es observable y app-level está en el último test del bloque (el 403 por
  // `tenantId` explícito ajeno): ahí la diferencia entre 403 y "lista vacía" solo la puede
  // producir el código.
  describe("aislamiento entre colegios", () => {
    it("no lista el evento de otro colegio", async () => {
      const res = await listRange(adminA);
      expect(res.status).toBe(200);
      expect(res.body.map((e) => e.id)).not.toContain(fixtures.tenantBEventId);
      expect(res.body.every((e) => e.tenantId === fixtures.tenantAId)).toBe(true);
    });

    it("devuelve 404 al pedir por id el evento de otro colegio", async () => {
      const res = await api<unknown>(`/events/${fixtures.tenantBEventId}`, {
        headers: headers(adminA),
      });
      expect(res.status).toBe(404);
    });

    // Da 404 y no 403 a propósito, y el detalle importa: la fila del tenant B es invisible
    // para una conexión con `app.tenant_id` del tenant A, así que el evento no existe antes
    // de que el servicio llegue a comparar tenants. RLS falla cerrado y de paso no confirma
    // que el id exista. El assertCanAccessTenant del servicio queda como segunda barrera
    // para el día en que alguien lea con contexto ajeno.
    it("no deja editar ni borrar el evento de otro colegio", async () => {
      const patch = await api<unknown>(`/events/${fixtures.tenantBEventId}`, {
        method: "PATCH",
        headers: headers(adminA, true),
        body: JSON.stringify({ title: "Secuestrado" }),
      });
      expect(patch.status).toBe(404);

      const del = await api<unknown>(`/events/${fixtures.tenantBEventId}`, {
        method: "DELETE",
        headers: headers(adminA),
      });
      expect(del.status).toBe(404);

      // Y la fila sigue intacta — leída con el contexto del tenant que sí es su dueño.
      const still = await inTenant(fixtures.tenantBId, () =>
        prisma.event.findUnique({
          where: { id: fixtures.tenantBEventId },
          select: { title: true, deletedAt: true },
        }),
      );
      expect(still).not.toBeNull();
      expect(still?.deletedAt).toBeNull();
      expect(still?.title).toBe("Evento privado del colegio B");
    });

    // Este es el único chequeo de aislamiento del bloque que RLS no puede satisfacer solo:
    // pedir `?tenantId=<otro colegio>` tiene que dar **403**, y la diferencia entre 403 y
    // "200 con lista vacía" solo la puede producir resolveTenantScope() en el código. Si la
    // app dejara pasar el parámetro, RLS devolvería cero filas en silencio y el cliente
    // creería que el otro colegio no tiene eventos — que es una respuesta distinta de "no
    // tienes por qué preguntar".
    //
    // Reversión verificada: haciendo que resolveTenantScope() devuelva `actor.tenantId` sin
    // lanzar cuando el tenantId pedido es ajeno, este test falla con 200 en vez de 403.
    it("rechaza con 403 pedir explícitamente el calendario de otro colegio", async () => {
      const res = await api<unknown>(
        `/events?from=${RANGE_FROM}&to=${RANGE_TO}&tenantId=${fixtures.tenantBId}`,
        { headers: headers(adminA) },
      );
      expect(res.status).toBe(403);
    });
  });

  // ─── Audiencia por rol y por grupo ──────────────────────────────────────────

  describe("audiencia", () => {
    let teacherOnlyId: string;
    let groupOneOnlyId: string;
    let groupTwoOnlyId: string;
    let everyoneId: string;

    beforeAll(async () => {
      const teacherOnly = await createEvent(adminA, {
        title: "Consejo académico (solo profesores)",
        type: CalendarEventType.REUNION,
        startsAt: "2026-05-05T14:00:00.000Z",
        endsAt: "2026-05-05T16:00:00.000Z",
        targetRole: UserRole.TEACHER,
      });
      const groupOneOnly = await createEvent(adminA, {
        title: "Salida pedagógica del grupo uno",
        startsAt: "2026-05-06T14:00:00.000Z",
        endsAt: "2026-05-06T16:00:00.000Z",
        groupId: fixtures.groupOneId,
      });
      const groupTwoOnly = await createEvent(adminA, {
        title: "Salida pedagógica del grupo dos",
        startsAt: "2026-05-07T14:00:00.000Z",
        endsAt: "2026-05-07T16:00:00.000Z",
        groupId: fixtures.groupTwoId,
      });
      const everyone = await createEvent(adminA, {
        title: "Izada de bandera (todo el colegio)",
        startsAt: "2026-05-08T12:30:00.000Z",
        endsAt: "2026-05-08T14:00:00.000Z",
      });

      expect(
        [teacherOnly, groupOneOnly, groupTwoOnly, everyone].map((r) => r.status),
      ).toEqual([201, 201, 201, 201]);

      teacherOnlyId = teacherOnly.body.id;
      groupOneOnlyId = groupOneOnly.body.id;
      groupTwoOnlyId = groupTwoOnly.body.id;
      everyoneId = everyone.body.id;
    });

    // Reversión verificada: haciendo que audienceFilter() devuelva `{}` para todos los
    // roles, este test falla — el acudiente ve el evento dirigido solo a profesores.
    it("un acudiente no ve un evento dirigido solo a profesores", async () => {
      const res = await listRange(guardian);
      expect(res.status).toBe(200);
      expect(res.body.map((e) => e.id)).not.toContain(teacherOnlyId);
    });

    it("un acudiente sí ve lo que va a todo el colegio", async () => {
      const res = await listRange(guardian);
      expect(res.body.map((e) => e.id)).toContain(everyoneId);
    });

    // Reversión verificada: quitando la rama `{ OR: [{ groupId: null }, { groupId: { in:
    // groupIds } }] }` del filtro, este test falla — el acudiente ve el evento del grupo
    // en el que no está su hijo.
    it("un acudiente ve el evento del grupo de su hijo y no el de otro grupo", async () => {
      const res = await listRange(guardian);
      const ids = res.body.map((e) => e.id);
      expect(ids).toContain(groupOneOnlyId);
      expect(ids).not.toContain(groupTwoOnlyId);
    });

    it("el profesor ve lo dirigido a su rol y lo de su grupo, no lo del grupo ajeno", async () => {
      const res = await listRange(teacher1);
      const ids = res.body.map((e) => e.id);
      expect(ids).toContain(teacherOnlyId);
      expect(ids).toContain(groupOneOnlyId);
      expect(ids).not.toContain(groupTwoOnlyId);
    });

    it("el staff administrativo ve todo lo del colegio", async () => {
      const res = await listRange(adminA);
      const ids = res.body.map((e) => e.id);
      expect(ids).toEqual(
        expect.arrayContaining([teacherOnlyId, groupOneOnlyId, groupTwoOnlyId, everyoneId]),
      );
    });

    // La audiencia va en el WHERE, no en un chequeo posterior: pedir por id un evento que
    // no te corresponde da 404 y no confirma que existe.
    it("un acudiente recibe 404 al pedir por id un evento que no le corresponde", async () => {
      const res = await api<unknown>(`/events/${teacherOnlyId}`, { headers: headers(guardian) });
      expect(res.status).toBe(404);
    });
  });

  // ─── Alcance del profesor (§9.2) ────────────────────────────────────────────

  describe("un profesor solo crea para sus grupos", () => {
    it("crea un evento en el grupo que enseña", async () => {
      const res = await createEvent(teacher1, {
        title: "Refuerzo de la clase",
        type: CalendarEventType.ACADEMICO,
        startsAt: "2026-06-02T14:00:00.000Z",
        endsAt: "2026-06-02T15:30:00.000Z",
        groupId: fixtures.groupOneId,
      });
      expect(res.status).toBe(201);
      expect(res.body.groupId).toBe(fixtures.groupOneId);
      expect(res.body.createdById).toBe(fixtures.teacher1UserId);
    });

    // Este es un IDOR **intra-tenant**: los dos grupos son del mismo colegio, así que la
    // política de RLS los deja pasar a los dos. Este chequeo es el único freno.
    //
    // Reversión verificada: haciendo que resolveWritableGroupId() devuelva `groupId` sin
    // validar contra resolveTeacherGroupIds(), este test falla con 201 en vez de 403.
    it("no puede crear un evento en el grupo de otro profesor", async () => {
      const res = await createEvent(teacher1, {
        title: "Invasión al grupo ajeno",
        startsAt: "2026-06-03T14:00:00.000Z",
        endsAt: "2026-06-03T15:30:00.000Z",
        groupId: fixtures.groupTwoId,
      });
      expect(res.status).toBe(403);
    });

    it("no puede crear un evento para todo el colegio (sin grupo)", async () => {
      const res = await createEvent(teacher1, {
        title: "Comunicado global de un profesor",
        startsAt: "2026-06-04T14:00:00.000Z",
        endsAt: "2026-06-04T15:30:00.000Z",
      });
      expect(res.status).toBe(403);
    });

    // Declarar un día no lectivo tiene efecto sobre asistencia y sobre todo el colegio:
    // es decisión institucional (§9.2).
    it("no puede declarar un día no lectivo", async () => {
      const res = await createEvent(teacher1, {
        title: "Día libre autoproclamado",
        type: CalendarEventType.FESTIVO,
        startsAt: "2026-06-05T05:00:00.000Z",
        endsAt: "2026-06-06T04:59:59.000Z",
        allDay: true,
        groupId: fixtures.groupOneId,
        isSchoolDayOff: true,
      });
      expect(res.status).toBe(403);
    });

    // Reversión verificada: quitando el chequeo `previous.createdById !== actor.id` de
    // loadForWrite(), este test falla con 200 en vez de 403.
    it("no puede editar ni borrar un evento que no creó", async () => {
      const admins = await createEvent(adminA, {
        title: "Evento del rector",
        startsAt: "2026-06-09T14:00:00.000Z",
        endsAt: "2026-06-09T15:00:00.000Z",
        groupId: fixtures.groupOneId,
      });
      expect(admins.status).toBe(201);

      const patch = await api<unknown>(`/events/${admins.body.id}`, {
        method: "PATCH",
        headers: headers(teacher1, true),
        body: JSON.stringify({ title: "Editado por el profesor" }),
      });
      expect(patch.status).toBe(403);

      const del = await api<unknown>(`/events/${admins.body.id}`, {
        method: "DELETE",
        headers: headers(teacher1),
      });
      expect(del.status).toBe(403);
    });

    it("sí puede editar el evento que creó él", async () => {
      const own = await createEvent(teacher1, {
        title: "Evento propio",
        startsAt: "2026-06-10T14:00:00.000Z",
        endsAt: "2026-06-10T15:00:00.000Z",
        groupId: fixtures.groupOneId,
      });
      expect(own.status).toBe(201);

      const patch = await api<EventPayload>(`/events/${own.body.id}`, {
        method: "PATCH",
        headers: headers(teacher1, true),
        body: JSON.stringify({ title: "Evento propio (corregido)" }),
      });
      expect(patch.status).toBe(200);
      expect(patch.body.title).toBe("Evento propio (corregido)");
    });

    it("el segundo profesor no ve alterado su grupo por el primero", async () => {
      const res = await listRange(teacher2);
      expect(res.status).toBe(200);
      expect(res.body.every((e) => e.groupId !== fixtures.groupOneId || e.targetRole === null)).toBe(
        true,
      );
    });
  });

  // ─── PATCH y validación ─────────────────────────────────────────────────────

  describe("edición", () => {
    it("audita la edición con la acción event.updated", async () => {
      const created = await createEvent(adminA, {
        title: "Evento auditado",
        startsAt: "2026-07-01T14:00:00.000Z",
        endsAt: "2026-07-01T15:00:00.000Z",
      });
      expect(created.status).toBe(201);

      const patch = await api<EventPayload>(`/events/${created.body.id}`, {
        method: "PATCH",
        headers: headers(adminA, true),
        body: JSON.stringify({ location: "Auditorio", reminderMinutesBefore: 1440 }),
      });
      expect(patch.status).toBe(200);
      expect(patch.body.reminderMinutesBefore).toBe(1440);

      const log = await inTenant(fixtures.tenantAId, () =>
        prisma.auditLog.findFirst({
          where: { action: "event.updated", entityId: created.body.id },
          select: { id: true },
        }),
      );
      expect(log).not.toBeNull();
    });

    // El PATCH parcial es donde esta validación se cae: el cuerpo trae solo `endsAt` y el
    // `startsAt` sale de la fila. Si se valida solo lo que llegó en el cuerpo, pasa.
    it("rechaza un PATCH que deja endsAt antes de startsAt", async () => {
      const created = await createEvent(adminA, {
        title: "Evento con rango válido",
        startsAt: "2026-07-02T14:00:00.000Z",
        endsAt: "2026-07-02T16:00:00.000Z",
      });
      expect(created.status).toBe(201);

      const patch = await api<unknown>(`/events/${created.body.id}`, {
        method: "PATCH",
        headers: headers(adminA, true),
        body: JSON.stringify({ endsAt: "2026-07-02T10:00:00.000Z" }),
      });
      expect(patch.status).toBe(400);
    });

    it("rechaza al crear un evento que termina antes de empezar", async () => {
      const res = await createEvent(adminA, {
        title: "Evento imposible",
        startsAt: "2026-07-03T16:00:00.000Z",
        endsAt: "2026-07-03T14:00:00.000Z",
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Todo el día y zona horaria ─────────────────────────────────────────────

  // Reversión verificada: haciendo que normalizeRange() devuelva `{ startsAt, endsAt }` sin
  // normalizar, este test falla — el evento arranca a las 19:00 del día anterior en hora de
  // Bogotá, que es exactamente el bug que `allDay` existe para prevenir.
  it("normaliza un evento de todo el día a los límites del día en la zona del colegio", async () => {
    const res = await createEvent(adminA, {
      title: "Día del Maestro",
      type: CalendarEventType.INSTITUCIONAL,
      // Medianoche UTC: en Bogotá (UTC-5) esto es el 14 de mayo a las 19:00.
      startsAt: "2026-05-15T00:00:00.000Z",
      endsAt: "2026-05-15T00:00:00.000Z",
      allDay: true,
    });
    expect(res.status).toBe(201);

    // 00:00 del 15 de mayo en Bogotá = 05:00Z del 15. 23:59:59.999 = 04:59:59.999Z del 16.
    expect(new Date(res.body.startsAt).toISOString()).toBe("2026-05-15T05:00:00.000Z");
    expect(new Date(res.body.endsAt).toISOString()).toBe("2026-05-16T04:59:59.999Z");
  });

  // Un rango de varios días tiene que conservarse completo. La forma fácil de romperlo es
  // anclar los dos extremos al mismo día: ahí "semana de desarrollo institucional" se
  // convierte en un evento de un lunes.
  it("conserva un rango de varios días en un evento de todo el día", async () => {
    const res = await createEvent(adminA, {
      title: "Semana de desarrollo institucional",
      startsAt: "2026-06-22T00:00:00.000Z",
      endsAt: "2026-06-26T00:00:00.000Z",
      allDay: true,
    });
    expect(res.status).toBe(201);
    expect(new Date(res.body.startsAt).toISOString()).toBe("2026-06-22T05:00:00.000Z");
    expect(new Date(res.body.endsAt).toISOString()).toBe("2026-06-27T04:59:59.999Z");
  });

  // ─── Borrado ────────────────────────────────────────────────────────────────

  // Reversión verificada: volviendo a `prisma.event.delete(...)` (el borrado físico que
  // tenía el servicio antes), este test falla — la fila desaparece de la tabla.
  it("borra en soft-delete: sale de la lista pero la fila se conserva", async () => {
    const created = await createEvent(adminA, {
      title: "Evento a borrar",
      startsAt: "2026-08-11T14:00:00.000Z",
      endsAt: "2026-08-11T15:00:00.000Z",
    });
    expect(created.status).toBe(201);

    const del = await api<{ id: string }>(`/events/${created.body.id}`, {
      method: "DELETE",
      headers: headers(adminA),
    });
    expect(del.status).toBe(200);

    const list = await listRange(adminA);
    expect(list.body.map((e) => e.id)).not.toContain(created.body.id);

    const byId = await api<unknown>(`/events/${created.body.id}`, { headers: headers(adminA) });
    expect(byId.status).toBe(404);

    // La fila sigue en la base con deletedAt: retención por Ley 1620 / Ley 527.
    const row = await inTenant(fixtures.tenantAId, () =>
      prisma.event.findUnique({
        where: { id: created.body.id },
        select: { deletedAt: true },
      }),
    );
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
  });

  // ─── isSchoolDayOff consumido por asistencia (§9.3) ─────────────────────────

  describe("día no lectivo y asistencia", () => {
    // La decisión fue **advertir, no bloquear**: asistencia ya está en producción y un sábado
    // de recuperación es un caso real. Lo que se prueba es que la sesión se crea Y que la
    // advertencia viene con ella.
    it("advierte al abrir asistencia en un día marcado como no lectivo, sin bloquear", async () => {
      const dayOff = await createEvent(adminA, {
        title: "Jornada pedagógica (sin clases)",
        type: CalendarEventType.INSTITUCIONAL,
        startsAt: "2026-10-05T00:00:00.000Z",
        endsAt: "2026-10-05T00:00:00.000Z",
        allDay: true,
        isSchoolDayOff: true,
      });
      expect(dayOff.status).toBe(201);

      const res = await api<{ id: string; schoolDayOffWarning: { eventId: string; title: string } | null }>(
        "/attendance/sessions",
        {
          method: "POST",
          headers: headers(teacher1, true),
          body: JSON.stringify({ scheduleId: fixtures.scheduleOneId, date: "2026-10-05" }),
        },
      );

      // No bloquea: la sesión existe.
      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      // Y advierte, citando el evento que lo causó.
      expect(res.body.schoolDayOffWarning).not.toBeNull();
      expect(res.body.schoolDayOffWarning?.eventId).toBe(dayOff.body.id);
      expect(res.body.schoolDayOffWarning?.title).toBe("Jornada pedagógica (sin clases)");

      await deleteAttendanceSession(res.body.id);
    });

    it("no advierte en un día lectivo normal", async () => {
      const res = await api<{ id: string; schoolDayOffWarning: unknown }>("/attendance/sessions", {
        method: "POST",
        headers: headers(teacher1, true),
        body: JSON.stringify({ scheduleId: fixtures.scheduleOneId, date: "2026-10-06" }),
      });
      expect(res.status).toBe(201);
      expect(res.body.schoolDayOffWarning).toBeNull();

      await deleteAttendanceSession(res.body.id);
    });

    // Un evento no lectivo de OTRO grupo no puede advertir sobre este: si advirtiera, la
    // salida pedagógica de 6B apagaría la asistencia de 5A.
    it("no advierte si el día no lectivo es de otro grupo", async () => {
      const otherGroupDayOff = await createEvent(adminA, {
        title: "Salida del grupo dos (sin clases para ellos)",
        startsAt: "2026-10-07T00:00:00.000Z",
        endsAt: "2026-10-07T00:00:00.000Z",
        allDay: true,
        isSchoolDayOff: true,
        groupId: fixtures.groupTwoId,
      });
      expect(otherGroupDayOff.status).toBe(201);

      const res = await api<{ id: string; schoolDayOffWarning: unknown }>("/attendance/sessions", {
        method: "POST",
        headers: headers(teacher1, true),
        body: JSON.stringify({ scheduleId: fixtures.scheduleOneId, date: "2026-10-07" }),
      });
      expect(res.status).toBe(201);
      expect(res.body.schoolDayOffWarning).toBeNull();

      await deleteAttendanceSession(res.body.id);
    });
  });

  // ─── Permisos de ruta ───────────────────────────────────────────────────────

  it("EVENTS_READ quedó cableado a una ruta real", async () => {
    const created = await createEvent(adminA, {
      title: "Evento leíble por id",
      startsAt: "2026-09-01T14:00:00.000Z",
      endsAt: "2026-09-01T15:00:00.000Z",
    });
    expect(created.status).toBe(201);

    const res = await api<EventPayload>(`/events/${created.body.id}`, { headers: headers(adminA) });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });
});

