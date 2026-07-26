// Entrega en vivo de la mensajería (docs/planning/chat-tiempo-real.md, Fases 1-2).
//
// El plan dice que cada fase se cierra "con verificación en navegador con dos sesiones
// simultáneas — sin eso no se está probando nada de lo que esta feature promete". Eso no se
// puede hacer con dos pestañas del mismo navegador: comparten `localStorage`, así que
// comparten sesión. Este spec lo sustituye con algo más fuerte y repetible: **un cliente
// socket.io real** conectado como el acudiente mientras el profesor envía por HTTP.
//
// Lo que se prueba es justamente lo que no se ve en un test de API: que el mensaje llega a
// quien no lo pidió, sin recargar nada.
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";
import { RedisIoAdapter } from "../src/core/realtime/redis-io.adapter";
import { RedisService } from "../src/core/redis/redis.service";
import { TenantRlsContextService } from "../src/core/prisma/tenant-rls-context.service";
import { ConfigService } from "@nestjs/config";
import {
  type Fixtures,
  GUARDIAN_EMAIL,
  PASSWORD,
  TEACHER_1_EMAIL,
  TENANT_A_SLUG,
  ensureFixtures,
} from "./helpers/calendar-fixtures";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tenant: { id: string; slug: string };
};

type IncomingMessage = {
  conversationId: string;
  message: { id: string; fromId: string; body: string; createdAt: string };
};

describe("Mensajería en tiempo real", () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let rls: TenantRlsContextService;
  let fixtures: Fixtures;

  let adapter: RedisIoAdapter;
  let teacher: LoginResponse;
  let guardian: LoginResponse;
  let guardianUserId: string;
  let conversationId: string;
  const createdMessageIds: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);

    // El adapter de Redis no se instala solo en un test: `main.ts` no corre acá. Sin esto el
    // gateway usa el adapter en memoria — que funcionaría para este test, pero entonces no se
    // estaría probando el camino real de producción.
    adapter = new RedisIoAdapter(app, app.get(RedisService), app.get(ConfigService));
    await adapter.connectToRedis();
    app.useWebSocketAdapter(adapter);

    await app.listen(0);
    baseUrl = await app.getUrl();

    prisma = app.get(PrismaService);
    rls = app.get(TenantRlsContextService);
    fixtures = await ensureFixtures(prisma, rls);

    teacher = await loginAs(TEACHER_1_EMAIL);
    guardian = await loginAs(GUARDIAN_EMAIL);

    guardianUserId = await rls.runWithTenant(fixtures.tenantAId, async () => {
      const user = await prisma.user.findUnique({
        where: { email: GUARDIAN_EMAIL },
        select: { id: true },
      });
      return user!.id;
    });

    const created = await api<{ id: string }>("/conversations", {
      method: "POST",
      headers: authHeaders(teacher, true),
      body: JSON.stringify({ participantId: guardianUserId }),
    });
    expect([200, 201]).toContain(created.status);
    conversationId = created.body.id;
  }, 180_000);

  afterAll(async () => {
    await rls.runWithTenant(fixtures.tenantAId, async () => {
      await prisma.conversationMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
    });
    await app.close();
    // Sin esto jest no termina: los clientes pub/sub son `duplicate()` del cliente global y
    // `app.close()` no los conoce. Se prefirió arreglarlo acá antes que ponerle `--forceExit`
    // al script de e2e, que taparía cualquier fuga futura.
    await adapter.disconnectFromRedis();
  });

  async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
  }

  async function loginAs(email: string, attempt = 1): Promise<LoginResponse> {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-slug": TENANT_A_SLUG },
      body: JSON.stringify({ email, password: PASSWORD, tenantSlug: TENANT_A_SLUG }),
    });
    if (res.status === 429 && attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
      return loginAs(email, attempt + 1);
    }
    expect(res.status).toBe(201);
    return res.body;
  }

  function authHeaders(session: LoginResponse, json = false): Record<string, string> {
    return {
      authorization: `Bearer ${session.accessToken}`,
      "x-tenant-slug": session.tenant.slug,
      ...(json ? { "content-type": "application/json" } : {}),
    };
  }

  /** Cliente socket del namespace de conversaciones, autenticado en el handshake. */
  function connect(token?: string): Socket {
    return io(`${baseUrl}/conversations`, {
      auth: token ? { token } : {},
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
  }

  function waitFor<T>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout esperando "${event}"`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  async function sendAs(session: LoginResponse, body: string) {
    const res = await api<{ id: string }>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: authHeaders(session, true),
      body: JSON.stringify({ body }),
    });
    expect(res.status).toBe(201);
    createdMessageIds.push(res.body.id);
    return res.body;
  }

  // ─── El corazón de la fase: deja de hacer falta el F5 ───────────────────────

  // Reversión verificada: quitando el `@OnEvent(MESSAGE_RECEIVED)` del gateway, este test
  // falla por timeout — que es exactamente el sintoma que tenía el producto antes: el mensaje
  // existe en la base y el destinatario nunca se entera.
  it("le entrega el mensaje al destinatario sin que lo pida", async () => {
    const socket = connect(guardian.accessToken);
    await waitFor(socket, "connect");

    const received = waitFor<IncomingMessage>(socket, "message:new");
    const sent = await sendAs(teacher, "¿Puede venir a la reunión del jueves?");
    const payload = await received;

    expect(payload.conversationId).toBe(conversationId);
    expect(payload.message.id).toBe(sent.id);
    expect(payload.message.body).toBe("¿Puede venir a la reunión del jueves?");

    socket.disconnect();
  });

  // El mensaje viaja dentro del evento y no se relee de la base a propósito: un @OnEvent puede
  // resolverse fuera del contexto de tenant y con RLS eso devuelve cero filas en silencio. Si
  // el payload llegara vacío o a medias, este test lo ve.
  it("el mensaje llega completo, no solo su id", async () => {
    const socket = connect(guardian.accessToken);
    await waitFor(socket, "connect");

    const received = waitFor<IncomingMessage>(socket, "message:new");
    await sendAs(teacher, "Traer el formato firmado");
    const payload = await received;

    expect(payload.message.body).toBe("Traer el formato firmado");
    expect(payload.message.fromId).toBeTruthy();
    expect(payload.message.createdAt).toBeTruthy();
    expect(new Date(payload.message.createdAt).toString()).not.toBe("Invalid Date");

    socket.disconnect();
  });

  // ─── Aislamiento del socket ─────────────────────────────────────────────────

  // Salas `user:{id}`: el emisor no está en `recipientUserIds`, así que no recibe su propio
  // eco. Importa porque el frontend ya lo pintó de forma optimista — si además llegara por
  // socket, se vería duplicado.
  it("el remitente no recibe el eco de su propio mensaje", async () => {
    const socket = connect(teacher.accessToken);
    await waitFor(socket, "connect");

    let echoed = false;
    socket.on("message:new", () => {
      echoed = true;
    });

    await sendAs(teacher, "Mensaje que no debería volver a mí");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(echoed).toBe(false);
    socket.disconnect();
  });

  /**
   * Se afirma sobre el estado final (`socket.connected`) y no esperando el evento
   * `disconnect`: el servidor cierra el socket en cuanto ve que no hay token válido, o sea
   * prácticamente en el mismo tick del `connect`. Escuchar `disconnect` después de que
   * `connect` resolvió llega tarde y da un timeout que parece un bug del gateway y es del
   * test — pasó al escribir esto.
   */
  async function assertRejected(socket: Socket) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(socket.connected).toBe(false);
    socket.disconnect();
  }

  // Reversión verificada: quitando el `client.disconnect(true)` del catch de
  // handleConnection, este test falla — el socket con token inválido queda conectado.
  it("rechaza un socket sin token", async () => {
    await assertRejected(connect());
  });

  it("rechaza un socket con un token inválido", async () => {
    await assertRejected(connect("no-es-un-jwt"));
  });
});
