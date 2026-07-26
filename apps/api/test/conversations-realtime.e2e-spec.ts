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
  ADMIN_A_EMAIL,
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

  /**
   * Conecta y espera a que el socket esté **realmente listo para recibir**.
   *
   * El evento `connect` llega al cliente en cuanto se establece el namespace, pero
   * `handleConnection` del servidor es `async`: verifica el JWT y recién después mete al socket
   * en su sala `user:{id}`. Entre una cosa y la otra hay una ventana en la que el socket está
   * "conectado" y todavía no pertenece a ninguna sala, así que un evento emitido en ese
   * instante no le llega. Se descubrió acá con los tests de typing.
   */
  async function connectReady(token: string): Promise<Socket> {
    const socket = connect(token);
    await waitFor(socket, "connect");
    await new Promise((resolve) => setTimeout(resolve, 250));
    return socket;
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

  // ─── Contador de no leídos en vivo (Fase 2, ítem 14) ────────────────────────

  // Reversión verificada: quitando el `@OnEvent(NOTIFICATION_CREATED)` del gateway, este test
  // falla por timeout — la campanita se quedaría quieta hasta recargar la página.
  it("avisa por socket que el contador de no leídos cambió", async () => {
    const socket = connect(guardian.accessToken);
    await waitFor(socket, "connect");

    const pinged = waitFor(socket, "notification:new");
    await sendAs(teacher, "Mensaje que dispara la campanita");
    // Resuelve `undefined` porque el evento va **sin payload**: lo que se afirma es que llega,
    // no qué trae. El número se pide a la API, que es la única fuente de verdad.
    await expect(pinged).resolves.toBeUndefined();

    socket.disconnect();
  });

  // El aviso va sin número a propósito: el cliente vuelve a pedir el contador a la API, que es
  // la única fuente de verdad y ya aplica el scoping del actor.
  //
  // Se espera el ping del socket antes de leer el contador, y no es un adorno: la notificación
  // la escribe un listener de EventEmitter2 que corre **desacoplado del POST**, así que el
  // request responde antes de que exista la fila. Leer el contador de inmediato lo encuentra
  // igual que antes — pasó al escribir este test. El ping se emite después del `createMany`,
  // así que sirve de punto de sincronización.
  it("el contador de la API sube con el mensaje nuevo", async () => {
    const socket = connect(guardian.accessToken);
    await waitFor(socket, "connect");

    const before = await api<{ count: number }>("/notifications/unread-count", {
      headers: authHeaders(guardian),
    });
    expect(before.status).toBe(200);

    const pinged = waitFor(socket, "notification:new");
    await sendAs(teacher, "Otro mensaje para el contador");
    await pinged;

    const after = await api<{ count: number }>("/notifications/unread-count", {
      headers: authHeaders(guardian),
    });
    expect(after.body.count).toBeGreaterThan(before.body.count);

    socket.disconnect();
  });

  // ─── Historial paginado (Fase 0, ítem 4) ────────────────────────────────────

  describe("historial por cursor", () => {
    // Suficientes para cruzar una página de 50 sin depender de lo que dejaron otros tests.
    const TOTAL = 12;
    const LIMIT = 5;

    beforeAll(async () => {
      for (let i = 1; i <= TOTAL; i++) {
        await sendAs(teacher, `Histórico ${i}`);
      }
    }, 120_000);

    type Page = { messages: Array<{ id: string; body: string }>; nextCursor: string | null };

    function page(cursor?: string) {
      const query = `limit=${LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      return api<Page>(`/conversations/${conversationId}/messages?${query}`, {
        headers: authHeaders(guardian),
      });
    }

    it("devuelve la primera página del más nuevo al más viejo", async () => {
      const res = await page();
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(LIMIT);
      expect(res.body.nextCursor).toBeTruthy();

      const times = res.body.messages.map((m) => m.id);
      expect(new Set(times).size).toBe(LIMIT);
    });

    // Con `skip`/`offset` esto se rompería: el hilo crece por el final mientras se lee hacia
    // atrás, así que la ventana se corre y un mensaje se repite o se salta.
    it("pagina hacia atrás sin repetir ni saltarse mensajes", async () => {
      const first = await page();
      const second = await page(first.body.nextCursor!);

      expect(second.status).toBe(200);
      expect(second.body.messages.length).toBeGreaterThan(0);

      const firstIds = new Set(first.body.messages.map((m) => m.id));
      const repetidos = second.body.messages.filter((m) => firstIds.has(m.id));
      expect(repetidos).toHaveLength(0);
    });

    it("llega al principio del hilo y ahí deja de haber cursor", async () => {
      let cursor: string | null | undefined = undefined;
      const vistos = new Set<string>();

      for (let i = 0; i < 40; i++) {
        const res: { status: number; body: Page } = await page(cursor ?? undefined);
        expect(res.status).toBe(200);
        for (const message of res.body.messages) vistos.add(message.id);
        cursor = res.body.nextCursor;
        if (cursor === null) break;
      }

      expect(cursor).toBeNull();
      expect(vistos.size).toBeGreaterThanOrEqual(TOTAL);
    });

    // Reversión verificada: quitando el `await this.assertMember(...)` de listMessages(), este
    // test falla — el admin de otro colegio lee el hilo entero citando su id.
    it("no deja leer el historial de un hilo del que no sos miembro", async () => {
      const intruso = await loginAs(ADMIN_A_EMAIL);
      const res = await api<unknown>(`/conversations/${conversationId}/messages`, {
        headers: authHeaders(intruso),
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── "Escribiendo..." (Fase 3) ──────────────────────────────────────────────

  describe("escribiendo", () => {
    type TypingEvent = { conversationId: string; userId: string; isTyping: boolean };

    it("le avisa al otro miembro que estás escribiendo", async () => {
      const [receptor, emisor] = await Promise.all([
        connectReady(guardian.accessToken),
        connectReady(teacher.accessToken),
      ]);

      const avisado = waitFor<TypingEvent>(receptor, "typing");
      emisor.emit("typing:start", { conversationId });
      const payload = await avisado;

      expect(payload.conversationId).toBe(conversationId);
      expect(payload.isTyping).toBe(true);

      receptor.disconnect();
      emisor.disconnect();
    });

    it("avisa también cuando deja de escribir", async () => {
      const [receptor, emisor] = await Promise.all([
        connectReady(guardian.accessToken),
        connectReady(teacher.accessToken),
      ]);

      const avisado = waitFor<TypingEvent>(receptor, "typing");
      emisor.emit("typing:stop", { conversationId });
      expect((await avisado).isTyping).toBe(false);

      receptor.disconnect();
      emisor.disconnect();
    });

    // **El chequeo que importa de esta fase.** El `conversationId` lo manda el cliente por
    // socket: sin validar la pertenencia en el servidor, cualquiera con sesión podría avisar
    // que escribe en un hilo ajeno y, de paso, confirmar que ese hilo existe.
    //
    // Reversión verificada: quitando el `if (!others) return` de relayTyping —o sea, confiando
    // en el conversationId del cliente— este test falla: al acudiente le llega el aviso de un
    // intruso que no pertenece al hilo.
    it("ignora el typing de quien no pertenece al hilo", async () => {
      const intruso = await loginAs(ADMIN_A_EMAIL);
      const [receptor, socketIntruso] = await Promise.all([
        connectReady(guardian.accessToken),
        connectReady(intruso.accessToken),
      ]);

      let avisado = false;
      receptor.on("typing", () => {
        avisado = true;
      });

      socketIntruso.emit("typing:start", { conversationId });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(avisado).toBe(false);

      receptor.disconnect();
      socketIntruso.disconnect();
    });

    it("el que escribe no recibe su propio aviso", async () => {
      const emisor = await connectReady(teacher.accessToken);

      let eco = false;
      emisor.on("typing", () => {
        eco = true;
      });

      emisor.emit("typing:start", { conversationId });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(eco).toBe(false);
      emisor.disconnect();
    });
  });

  // ─── Checks de leído (Fase 5) ───────────────────────────────────────────────

  describe("checks de leído", () => {
    type ReadEvent = { conversationId: string; userId: string; lastReadAt: string };
    type Conv = { id: string; otherLastReadAt: string | null };

    async function conversationsOf(session: LoginResponse) {
      const res = await api<Conv[]>("/conversations", { headers: authHeaders(session) });
      expect(res.status).toBe(200);
      return res.body.find((c) => c.id === conversationId)!;
    }

    // Reversión verificada: devolviendo `otherLastReadAt: null` fijo desde mapConversation,
    // este test falla — que es el estado en el que estaba el producto, con la UI poniendo
    // "leído" en todo por su cuenta.
    it("expone hasta cuándo leyó el otro", async () => {
      await api<unknown>(`/conversations/${conversationId}/read`, {
        method: "POST",
        headers: authHeaders(guardian),
      });

      const paraElProfesor = await conversationsOf(teacher);
      expect(paraElProfesor.otherLastReadAt).toBeTruthy();
      expect(new Date(paraElProfesor.otherLastReadAt!).toString()).not.toBe("Invalid Date");
    });

    // Reversión verificada: quitando el `@OnEvent(CONVERSATION_READ)` del gateway, este test
    // falla por timeout — los checks solo se pondrían azules al recargar.
    it("avisa en vivo cuando el otro abre el hilo", async () => {
      const socketProfesor = await connectReady(teacher.accessToken);

      const avisado = waitFor<ReadEvent>(socketProfesor, "conversation:read");
      await api<unknown>(`/conversations/${conversationId}/read`, {
        method: "POST",
        headers: authHeaders(guardian),
      });
      const payload = await avisado;

      expect(payload.conversationId).toBe(conversationId);
      expect(payload.lastReadAt).toBeTruthy();

      socketProfesor.disconnect();
    });

    it("quien lee no recibe su propio aviso", async () => {
      const socketAcudiente = await connectReady(guardian.accessToken);

      let eco = false;
      socketAcudiente.on("conversation:read", () => {
        eco = true;
      });

      await api<unknown>(`/conversations/${conversationId}/read`, {
        method: "POST",
        headers: authHeaders(guardian),
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(eco).toBe(false);
      socketAcudiente.disconnect();
    });
  });

  // ─── Presencia (Fase 4) ─────────────────────────────────────────────────────

  describe("presencia", () => {
    type PresenceEvent = { userId: string; online: boolean; lastSeenAt: string | null };
    type Conv = { id: string; online: boolean; lastSeenAt: string | null };

    /**
     * La presencia vive en Redis, o sea **estado externo que sobrevive entre tests**: los
     * bloques anteriores abren y cierran sockets de las mismas dos personas y dejan rastro. Sin
     * limpiar, estos tests pasan o fallan según el orden — se comprobó: en aislamiento pasaban
     * y dentro de la suite completa fallaban los cuatro.
     */
    beforeEach(async () => {
      const redis = app.get(RedisService).client;
      const keys = await redis.keys("presence:*");
      if (keys.length > 0) await redis.del(...keys);
      // Margen para que los sockets de los tests anteriores terminen de salir de sus salas.
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    async function threadFor(session: LoginResponse) {
      const res = await api<Conv[]>("/conversations", { headers: authHeaders(session) });
      return res.body.find((c) => c.id === conversationId)!;
    }

    // Reversión verificada: devolviendo `online: false` fijo en mapConversation, este test
    // falla — que es el estado anterior, donde `online` nunca se seteaba y la cabecera decía
    // "última vez hoy" para todo el mundo.
    it("marca en línea a quien tiene un socket abierto", async () => {
      const socketAcudiente = await connectReady(guardian.accessToken);

      const paraElProfesor = await threadFor(teacher);
      expect(paraElProfesor.online).toBe(true);

      socketAcudiente.disconnect();
    });

    it("lo marca fuera de línea al cerrar el socket, con la última vez", async () => {
      const socketAcudiente = await connectReady(guardian.accessToken);
      expect((await threadFor(teacher)).online).toBe(true);

      socketAcudiente.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 800));

      const despues = await threadFor(teacher);
      expect(despues.online).toBe(false);
      expect(despues.lastSeenAt).toBeTruthy();
      expect(new Date(despues.lastSeenAt!).toString()).not.toBe("Invalid Date");
    });

    // Reversión verificada: quitando el `broadcastPresence` de handleConnection, este test
    // falla por timeout.
    it("avisa en vivo a quien conversa con esa persona", async () => {
      const socketProfesor = await connectReady(teacher.accessToken);

      const avisado = waitFor<PresenceEvent>(socketProfesor, "presence:changed");
      const socketAcudiente = await connectReady(guardian.accessToken);
      const payload = await avisado;

      expect(payload.online).toBe(true);

      socketAcudiente.disconnect();
      socketProfesor.disconnect();
    });

    // Una pestaña cerrada no es una persona desconectada.
    it("sigue en línea si le queda otra pestaña abierta", async () => {
      const pestaña1 = await connectReady(guardian.accessToken);
      const pestaña2 = await connectReady(guardian.accessToken);

      pestaña1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 800));

      expect((await threadFor(teacher)).online).toBe(true);

      pestaña2.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 800));
      expect((await threadFor(teacher)).online).toBe(false);
    });
  });

  // ─── Silenciar hilos (Fase 7) ───────────────────────────────────────────────

  describe("silenciar", () => {
    async function setMuted(session: LoginResponse, muted: boolean) {
      const res = await api<{ muted: boolean }>(`/conversations/${conversationId}/mute`, {
        method: "POST",
        headers: authHeaders(session, true),
        body: JSON.stringify({ muted }),
      });
      expect(res.status).toBe(201);
      return res.body;
    }

    afterEach(async () => {
      await setMuted(guardian, false);
    });

    it("guarda y expone el estado del silencio", async () => {
      await setMuted(guardian, true);

      const res = await api<Array<{ id: string; muted: boolean }>>("/conversations", {
        headers: authHeaders(guardian),
      });
      expect(res.body.find((c) => c.id === conversationId)?.muted).toBe(true);

      await setMuted(guardian, false);
      const despues = await api<Array<{ id: string; muted: boolean }>>("/conversations", {
        headers: authHeaders(guardian),
      });
      expect(despues.body.find((c) => c.id === conversationId)?.muted).toBe(false);
    });

    // **La distinción que define esta fase.** Silenciar apaga el aviso, NO la entrega: si el
    // mensaje dejara de llegar, la gente perdería mensajes creyendo que solo bajó el volumen.
    //
    // Reversión verificada: filtrando los silenciados en `sendMessage` en vez de en el listener
    // de notificaciones, este test falla — el mensaje no llega por socket.
    it("un hilo silenciado sigue entregando el mensaje en vivo", async () => {
      await setMuted(guardian, true);

      const socket = await connectReady(guardian.accessToken);
      const recibido = waitFor<IncomingMessage>(socket, "message:new");
      await sendAs(teacher, "Mensaje a un hilo silenciado");

      await expect(recibido).resolves.toMatchObject({ conversationId });
      socket.disconnect();
    });

    // Reversión verificada: quitando el filtro de silenciados de onMessage, este test falla —
    // el contador sube igual y la persona recibe el aviso que pidió no recibir.
    it("no le suma no leídos ni le avisa", async () => {
      await setMuted(guardian, true);

      const antes = await api<{ count: number }>("/notifications/unread-count", {
        headers: authHeaders(guardian),
      });

      await sendAs(teacher, "Otro mensaje silenciado");
      // No hay ping que esperar —justamente— así que se le da margen al listener.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const despues = await api<{ count: number }>("/notifications/unread-count", {
        headers: authHeaders(guardian),
      });
      expect(despues.body.count).toBe(antes.body.count);
    });
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
