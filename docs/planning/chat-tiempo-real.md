# Plan: Chat en Tiempo Real

> Plan técnico para convertir el módulo de mensajería (Fases 1-5, ya en `develop`) en un
> chat en tiempo real. Auditoría hecha sobre el código real de `develop` el 2026-07-16 —
> cada afirmación de "existe" o "no existe" se verificó leyendo el archivo, no de memoria.
> **No se ha implementado nada de lo aquí descrito todavía.**
>
> Alcance aprobado por el dueño del producto el 2026-07-16: **completo estilo WhatsApp**
> (entrega en vivo + "escribiendo..." + presencia + checks de leído en vivo + adjuntos +
> silenciar). Esto constituye la aprobación explícita que exige `AGENTS.md` para
> "Chat complejo tipo WhatsApp".

## 1. Punto de partida

**Tiempo real hoy: cero.** No hay WebSocket, ni SSE, ni siquiera polling. Verificado por
grep exhaustivo de `socket.io` / `@nestjs/websockets` / `ws` / `EventSource` /
`text/event-stream` / `@WebSocketGateway` / `pusher` / `ably` sobre `apps/api/src`,
`apps/web` y los 3 `package.json`: **cero dependencias, cero código**. El único hit del
lock file es el `peerDependency` opcional que declara `@nestjs/core` — no es un paquete
instalado.

La consecuencia concreta, hoy, en producción:

```ts
// apps/web/components/messages/messaging-panel.tsx:180-182
useEffect(() => {
  void loadData()
}, [loadData])          // loadData es useCallback con deps [currentUserId, canBroadcast]
                        // → ambos estables → el efecto corre UNA vez, en el mount.
```

**Si un profesor te escribe mientras tienes `/familia/mensajes` abierto, no te enteras
nunca.** El mensaje solo aparece si recargas la página (F5) o si tú envías algo (lo cual
dispara un `loadData()` completo).

### Lo que ya juega a favor

| Activo | Dónde | Por qué importa |
|---|---|---|
| **Redis conectado y sin usar** | `apps/api/src/core/redis/redis.service.ts:7-12`, módulo `@Global()` (`redis.module.ts:4`) | `RedisService` expone `readonly client: Redis` y **ningún servicio lo inyecta hoy**. `client.duplicate()` es exactamente lo que pide el adaptador pub/sub de socket.io. Ya está desplegado en Railway (prod y shared-dev, `REDIS_URL=${{Redis.REDIS_URL}}`). |
| **El evento ya se emite, con los destinatarios resueltos** | `conversations.service.ts:259-266` (`sendMessage`) y `:175-182` (`broadcast`) | `MESSAGE_RECEIVED` ya lleva `{ tenantId, conversationId, messageId, fromUserId, recipientUserIds, preview }` (`notifications.events.ts:39-46`). El gateway solo tiene que engancharse con otro `@OnEvent` — cero cambios en los productores. |
| **JWT legible desde JS** | `apps/web/lib/auth.ts:41,55,65-67` | Las cookies `classia_at`/`classia_rt` las escribe `document.cookie` → no son `httpOnly`. `getAccessToken()` es accesible, así que el handshake (`io(url, { auth: { token } })`) no requiere tocar el modelo de auth. |
| **`trust proxy` ya activo** | `apps/api/src/app.setup.ts:15-18` | Necesario tras el proxy de Railway para que el upgrade de WS resuelva bien la IP. Ya hecho. |
| **`main.ts` limpio** | `apps/api/src/main.ts` (16 líneas) | `app.useWebSocketAdapter(...)` entra entre `setupApp(app)` y `app.listen(port)` sin fricción. |
| **Autorización de dominio probada** | `assertMember` (`conversations.service.ts:339-348`), cubierta por e2e (`backend-v1.e2e-spec.ts:412-540`) | Valida tenant + pertenencia. El gateway la reutiliza tal cual; no hay que rediseñar el modelo de acceso. |

### Los indicadores decorativos (mentiras que la UI ya cuenta)

`chat-interface.tsx` **ya promete tiempo real que no existe**. Esto no es solo deuda
cosmética: define la meta, porque el usuario ya cree que estas cosas funcionan.

| Elemento | Dónde | Realidad |
|---|---|---|
| `"escribiendo..."` | `chat-interface.tsx:474-476, 527-528` | `conversation.typing` nunca se setea. El hueco existe en el tipo (`:41-42`). |
| `"en línea"` / punto verde | `chat-interface.tsx:458-460, 529-531` | `conversation.online` nunca se setea. |
| `"última vez hoy"` | `chat-interface.tsx:531` | **String literal hardcodeado.** |
| Checks ✓✓ azules | `chat-interface.tsx:238-245` | `mapConversation` (`messaging-panel.tsx:102`) pone **siempre** `status: "read"`. Todo se ve leído siempre. El backend **sí** calcula `unreadCount` real (`conversations.service.ts:496-498`) y la UI lo ignora. |
| Botones Video / Phone / Mic / adjuntar | `chat-interface.tsx:535-540, 607-637` | Sin `onClick`. Decorativos. |

## 2. El bloqueador que hay que resolver ANTES de tocar el socket

**`GET /conversations` devuelve el historial completo de todos los hilos, sin paginar.**

```ts
// apps/api/src/modules/conversations/conversations.service.ts:534-538
messages: {
  where: { deletedAt: null },
  orderBy: { createdAt: "asc" as const },
  select: this.messageSelect(),        // ← sin take, sin cursor, sin límite
},
```

Y no existe `GET /conversations/:id` ni `GET /conversations/:id/messages`. El único modo
de leer un mensaje es descargarlos **todos**.

La causa raíz es de modelo: **`Conversation` no tiene `lastMessageAt` ni `updatedAt`**
(`schema.prisma:436-452`). Por eso el "último mensaje" y el orden de la lista se calculan
en JS trayendo todo a memoria:

```ts
// conversations.service.ts:500 — necesita TODOS los mensajes solo para saber el último
const lastMessage = conversation.messages[conversation.messages.length - 1] ?? null;
// conversations.service.ts:48-50 — ordena en JS lo que debería ordenar Postgres
.map((conversation) => this.mapConversation(conversation, actor))
.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
```

**Un profesor con 60 familias y 200 mensajes cada una descarga ~12.000 mensajes por cada
tecla Enter** — porque `handleSendMessage` hace `loadData()` completo tras el POST
(`messaging-panel.tsx:191`).

> **Poner WebSockets encima de esto no arregla el coste: lo multiplica.** Si cada mensaje
> entrante dispara el mismo `loadData()`, el chat en tiempo real convierte un problema de
> 1 request por tecla en 1 request por mensaje de cualquier persona. La Fase 0 no es
> opcional ni es "limpieza previa": es el requisito para que el resto tenga sentido.

## 3. Cambios de modelo

```prisma
model Conversation {
  // ... campos actuales sin tocar ...
  lastMessageAt DateTime? // desnormalizado: se escribe en cada sendMessage/broadcast.
                          // Habilita ordenar y paginar en Postgres en vez de en JS.
  directKey     String?   // "{userIdMenor}:{userIdMayor}" para type=DIRECT. Cierra la
                          // race condition de getOrCreateDirectConversationId.

  @@unique([tenantId, directKey])            // ← un solo hilo DIRECT por par, garantizado
  @@index([tenantId, lastMessageAt])         // ← orden de la bandeja
  @@index([tenantId, type])                  // (ya existe)
}

model ConversationMessage {
  // ... campos actuales sin tocar ...
  clientMessageId String? // uuid generado por el cliente: deduplica el eco del socket
                          // contra el optimistic update.

  @@unique([conversationId, clientMessageId])
  @@index([conversationId, createdAt])       // (ya existe)
}
```

`ConversationMember.mutedAt` **ya existe** en el schema (`:462`) y nunca se lee ni se
escribe — la Fase 7 lo activa sin migración.

### Por qué `directKey` y no un `@@unique` sobre los miembros

Prisma no puede expresar "único por par de miembros" (los miembros están en otra tabla).
Hoy `getOrCreateDirectConversationId` (`conversations.service.ts:206-232`) hace
`findFirst` y luego `create` **sin transacción**: dos peticiones simultáneas crean **dos
hilos duplicados**. Con WebSockets la concurrencia sube y esto se vuelve más probable.
Un `directKey` derivado y ordenado (`[a, b].sort().join(":")`) lo resuelve con un
constraint de base de datos en vez de con optimismo.

**Migración de datos**: backfill de `lastMessageAt` (`MAX(createdAt)` por conversación) y
de `directKey` para los DIRECT existentes. Si el backfill encuentra pares duplicados
—posible, dada la race actual— hay que fusionarlos antes de aplicar el `@@unique`; el
soft-delete obligatorio por Ley 1620/527 significa **mover los mensajes al hilo
superviviente, nunca borrarlos**.

## 4. Arquitectura

**socket.io sobre `@nestjs/websockets`, con el adaptador de Redis desde el día 1.**

### Por qué socket.io y no SSE

SSE es más simple y bastaría para "los mensajes llegan solos", pero el alcance aprobado
incluye "escribiendo..." y presencia, que son **cliente → servidor**. SSE es
unidireccional; forzarlo obligaría a un canal HTTP paralelo para el typing, es decir dos
transportes que mantener. socket.io además trae reconexión con backoff, salas y el
adaptador de Redis ya resueltos, y NestJS lo soporta de primera clase.

### Por qué el adaptador de Redis desde el primer commit y no "cuando escalemos"

`EventEmitter2` (`app.module.ts:48`) es **estrictamente in-process**. Hoy Railway corre
1 réplica y un gateway ingenuo con `@OnEvent` funcionaría. Pero en el momento en que se
suba a 2 réplicas **el chat se rompe en silencio**: el mensaje se emite en la instancia A
y el socket del destinatario está conectado a la instancia B, que nunca se entera.
El síntoma —"a algunos usuarios les llegan los mensajes y a otros no, aleatoriamente"— es
de los más caros de diagnosticar en producción. El `RedisService` global ya está ahí y
sin usar: hacerlo bien cuesta un archivo.

```ts
// apps/api/src/core/realtime/redis-io.adapter.ts
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication, private readonly redis: RedisService) { super(app); }

  async connectToRedis() {
    const pubClient = this.redis.client.duplicate();   // ← el cliente que ya existe
    const subClient = this.redis.client.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      transports: ["websocket"],   // ← Railway NO tiene sticky sessions: el fallback a
                                   //   long-polling se rompería con >1 réplica.
      cors: buildCorsOptions(this.config),  // ← socket.io NO hereda app.enableCors()
    });
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

> **Trampa clásica nº1**: `app.enableCors()` (`app.setup.ts:28-56`) aplica **solo** al
> handler HTTP de Express. socket.io necesita su propia config de CORS. La lógica de
> origen dinámico de `app.setup.ts:29-54` (localhost/IP privada en dev, cualquier
> subdominio de `app.domain`, más `APP_CORS_ORIGINS`) hay que **extraerla a una función
> compartida** y usarla en ambos sitios, no copiarla.

> **Trampa clásica nº2**: `JwtAuthGuard` usa `context.switchToHttp().getRequest()`
> (`jwt-auth.guard.ts:16`) → **es inservible en un gateway**. Hace falta un `WsJwtGuard`
> que use `context.switchToWs().getClient()` y lea el token del handshake. La lógica de
> verificación (`:24-30`) y el poblado de `user` con `getPermissionsForRole(payload.role)`
> (`:32-40`) sí son reutilizables — extraerlas a un helper compartido por los dos guards.

### Salas

**Una sala por usuario: `user:{userId}`.** No salas por conversación.

Razón: el evento `MESSAGE_RECEIVED` ya trae `recipientUserIds` resuelto por el servicio
(que ya aplicó todo el scoping de rol/tenant). Emitir a `user:{id}` reutiliza esa decisión
en vez de duplicarla. Salas por conversación obligarían a suscribir/desuscribir en cada
apertura de hilo y a revalidar pertenencia en cada join — más superficie de error para el
mismo resultado. El aislamiento entre tenants es implícito: un `userId` pertenece a un
solo tenant.

Para typing sí hace falta saber los miembros del hilo → se resuelve en el momento con
`assertMember` + los `ConversationMember`, que es exactamente lo que ya hace el servicio.

### El token expira a los 15 minutos

`setTokens` (`auth.ts:55`) da al access token **15 minutos de vida**, y un socket se
autentica **una sola vez, en el handshake**. Hoy `refreshAccessToken()` (`auth.ts:158-176`)
solo se dispara de forma reactiva ante un **401 HTTP** (`api-client.ts:55-70`) — y un
socket abierto nunca produce un 401.

Decisión: **el servidor desconecta con un motivo tipado (`token_expired`) al vencer el
token; el cliente refresca y reconecta.** El gateway guarda el `exp` del payload en el
socket y programa la desconexión. Esto es preferible a un socket eterno autenticado con
un token muerto, y reutiliza el `refreshAccessToken()` que ya existe. La reconexión
automática de socket.io hace el resto transparente para el usuario.

## 5. Contrato de eventos

**Servidor → cliente**

| Evento | Payload | Emitido desde |
|---|---|---|
| `message:new` | `{ conversationId, message: Message, clientMessageId? }` | `@OnEvent(MESSAGE_RECEIVED)` → `user:{id}` de cada `recipientUserIds` |
| `conversation:read` | `{ conversationId, userId, lastReadAt }` | `markRead` → el otro miembro. Vuelve azules los checks. |
| `typing` | `{ conversationId, userId, isTyping }` | Relay efímero, sin BD |
| `presence:changed` | `{ userId, online, lastSeenAt }` | connect/disconnect → contactos del usuario |
| `message:deleted` | `{ conversationId, messageId }` | `softDeleteMessage` |

**Cliente → servidor**

| Evento | Payload | Validación |
|---|---|---|
| `typing:start` / `typing:stop` | `{ conversationId }` | `assertMember` (reusa `conversations.service.ts:339-348`) |
| `presence:heartbeat` | `{}` | refresca el TTL en Redis |

Los mensajes se siguen enviando por **HTTP POST**, no por socket. Razón: el POST ya tiene
guards, validación Zod, auditoría y manejo de errores probados por e2e; duplicar esa
cadena sobre el socket es superficie de ataque nueva a cambio de nada. El socket es para
**recibir**. Esto también mantiene el chat funcionando (degradado, sin push) si el
WebSocket cae.

## 6. Presencia

Un `Set` de Redis por tenant, con TTL por usuario:

```
SADD  presence:{tenantId}         {userId}      # en connect
SETEX presence:hb:{userId}  60    "1"           # heartbeat cada 30s desde el cliente
SREM  presence:{tenantId}         {userId}      # en disconnect (último socket del usuario)
```

El TTL del heartbeat cubre el caso "el navegador murió sin disconnect limpio" (cierre de
laptop, pérdida de red) — sin él, la gente se queda "en línea" para siempre.

Alternativa considerada y descartada: `io.in("user:X").allSockets()`, que con el adaptador
de Redis sí funciona cluster-wide. Es más simple pero es **O(N) round-trips para pintar
una lista de 60 contactos**. El `Set` se lee de una.

`lastSeenAt` (para reemplazar el `"última vez hoy"` hardcodeado de `chat-interface.tsx:531`)
se guarda en Redis en el disconnect. **No va a Postgres**: es dato efímero de altísima
escritura y perderlo en un reinicio de Redis no tiene consecuencia (degrada a "sin
información", que es lo correcto).

## 7. Frontend

```ts
// apps/web/lib/realtime.ts — fuente única de la conexión, un socket por pestaña.
export function useSocket(): Socket | null      // conecta con getAccessToken(), reconecta al refrescar
export function useConversationStream(onEvent)  // suscripción tipada a los eventos de §5
```

El cambio de fondo en `MessagingPanel`: **`message:new` NO debe disparar `loadData()`**.
Debe insertar el mensaje en el estado local. Si el mensaje entrante recarga los 12.000
mensajes, no se arregló nada (ver §2).

Además hay que arreglar dos cosas que hoy están mal y que el tiempo real empeora:

1. **El optimistic update no hace rollback.** `messaging-panel.tsx:190` es
   `if (res.ok) { void loadData() }` — sin `else`. Si el POST falla, el mensaje se queda
   en pantalla y el usuario cree que lo envió. Necesita estado `sending → sent | failed`
   con reintento.
2. **El id optimista es `Date.now().toString()`** (`chat-interface.tsx:159`), que colisiona
   conceptualmente con los UUID reales. Con `clientMessageId` (§3) el eco del socket se
   reconcilia contra el mensaje optimista en vez de duplicarlo.

Los checks ✓✓ dejan de ser un literal: para un hilo DIRECT, un mensaje propio está leído
si `otroMiembro.lastReadAt >= message.createdAt`. **El dato ya está en el modelo**
(`ConversationMember.lastReadAt`, ya seleccionado en `conversationSelect:522`) — no hace
falta migración, solo dejar de mentir en `mapConversation` (`messaging-panel.tsx:102`).

## 8. Plan por fases

Cada fase se cierra con: typecheck limpio (api + web), e2e verdes, y verificación en
navegador con **dos sesiones simultáneas** (profesor y acudiente en ventanas distintas) —
sin eso no se está probando nada de lo que esta feature promete.

**Fase 0 — Paginación (bloqueante, sin UI nueva)**
1. Migración: `Conversation.lastMessageAt` + `directKey` + `@@unique([tenantId, directKey])`
   + `@@index([tenantId, lastMessageAt])`; `ConversationMessage.clientMessageId` +
   `@@unique([conversationId, clientMessageId])`. Backfill y fusión de duplicados.
2. `sendMessage`/`broadcast` escriben `lastMessageAt`; `getOrCreateDirectConversationId`
   usa `upsert` sobre `directKey` (adiós race condition).
3. `GET /conversations` deja de embeber `messages` → devuelve `lastMessage` + `unreadCount`
   + `lastMessageAt`, ordenado y paginado en Postgres.
4. **Nuevo** `GET /conversations/:id/messages?cursor=&limit=50` con paginación por cursor
   descendente.
5. `MessagingPanel` carga la bandeja y trae los mensajes del hilo **al abrirlo**, con
   scroll infinito hacia arriba.

> Fase 0 se puede mergear sola y **ya mejora el producto** (deja de descargar 12.000
> mensajes por tecla) aunque no se siga con el resto.

**Fase 1 — Transporte**
6. `pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io @socket.io/redis-adapter`
   (api) y `socket.io-client` (web).
7. Extraer la lógica de CORS de `app.setup.ts:29-54` a una función compartida.
8. `RedisIoAdapter` + `app.useWebSocketAdapter()` en `main.ts`.
9. `WsJwtGuard` + extraer el helper de verificación compartido con `JwtAuthGuard`.
10. `ConversationsGateway` con salas `user:{id}`, desconexión por `token_expired`.
11. `lib/realtime.ts` en el front. Criterio de cierre de la fase: el socket conecta,
    autentica, sobrevive a un refresh de token y reconecta al caerse la red.

**Fase 2 — Entrega en vivo** (el corazón: aquí deja de hacer falta el F5)
12. `@OnEvent(MESSAGE_RECEIVED)` en el gateway → `message:new` a cada destinatario.
13. `MessagingPanel` inserta el mensaje (sin `loadData()`), reconcilia por `clientMessageId`,
    y hace rollback del optimistic si el POST falla.
14. Badge de no leídos **en vivo en los 3 sidebars**. Nota: `GET /notifications/unread-count`
    **ya existe** (`notifications.controller.ts:22-25`) y **cero archivos de `apps/web` lo
    llaman** — la campanita nunca tuvo badge. Se conecta aquí y se mantiene vivo por socket.

**Fase 3 — "Escribiendo..."**
15. `typing:start`/`typing:stop` con debounce (~2s) + relay. Activa el hueco muerto de
    `chat-interface.tsx:474-476`.

**Fase 4 — Presencia**
16. Set de Redis + heartbeat + TTL. Activa `online` y reemplaza el `"última vez hoy"`
    hardcodeado (`chat-interface.tsx:531`) por `lastSeenAt` real.

**Fase 5 — Checks de leído en vivo**
17. `mapConversation` calcula el status real desde `lastReadAt` (sin migración).
18. `markRead` emite `conversation:read` → los checks se vuelven azules en vivo.

**Fase 6 — Adjuntos en el chat**
19. `sendMessageSchema` **ya acepta** `attachmentKey`/`attachmentName`
    (`conversations.schemas.ts:9-13`) y el modelo ya los tiene — es puro frontend: cablear
    `FileUploadField` (ya existe) al botón de adjuntar, que hoy no tiene `onClick`
    (`chat-interface.tsx:618-624`), y renderizar el adjunto con `AttachmentPreviewDialog`
    (ya existe).

**Fase 7 — Silenciar hilos**
20. `ConversationMember.mutedAt` ya existe y está muerto (`schema.prisma:462`). Endpoint
    de mute/unmute + respetarlo en `NotificationsListeners` (`notifications.listeners.ts:72-83`)
    para no mandar email de un hilo silenciado.

**Limpieza que acompaña (cualquier fase)**
21. Borrar `app/admin/mensajes/nuevo/page.tsx` y `app/profesor/mensajes/nuevo/page.tsx`:
    dicen *"estará disponible cuando se conecte el módulo de mensajería, que otro equipo
    está construyendo"* — el módulo lleva conectado desde `eda38c4`. Los quick-actions de
    ambos dashboards siguen apuntando a esas rutas muertas. (Ya listado como ítem 5 de la
    Fase 1 de `frontend-unificacion-roles.md`.)
22. Quitar los botones decorativos sin `onClick` (Video, Phone, Mic) o implementarlos —
    pero no dejarlos mintiendo.

## 9. Decisiones registradas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| socket.io | SSE | El alcance aprobado incluye typing y presencia, que son cliente→servidor. SSE es unidireccional. |
| Adaptador de Redis desde el commit 1 | "Cuando escalemos" | Con 2 réplicas sin adaptador el chat se rompe **en silencio**. El `RedisService` global ya existe sin usar. |
| Salas `user:{id}` | Salas por conversación | El evento ya trae `recipientUserIds` con el scoping aplicado. Salas por hilo duplican la decisión de acceso. |
| Enviar por HTTP, recibir por socket | Todo por socket | El POST ya tiene guards + Zod + auditoría + e2e. El chat degrada a funcional sin push si el WS cae. |
| Desconectar al expirar el token | Socket eterno / refresh por socket | El access token vive 15 min y el refresh de hoy solo reacciona a un 401 HTTP que un socket nunca produce. |
| `lastSeenAt` en Redis | En Postgres | Escritura altísima, valor efímero; perderlo degrada a "sin información", que es correcto. |
| `directKey` | Transacción con lock | Un constraint de BD es más barato y más fiable que optimismo. |
| `transports: ["websocket"]` | Fallback a long-polling | Railway no ofrece sticky sessions: el polling se rompe con >1 réplica. |

## 10. Riesgos

- **Fase 0 tiene migración con backfill y posible fusión de hilos duplicados.** Es la
  única fase con riesgo de datos. La retención obligatoria (Ley 1620 / Ley 527) implica
  **mover** mensajes al hilo superviviente, nunca borrarlos. Contar y revisar los
  duplicados en shared-dev **antes** de correr nada en producción.
- **`STUDENT` no tiene ningún permiso `MESSAGING_*`** (`permissions.ts:493-510`),
  `listContacts` devuelve `[]` para él (`conversations.service.ts:84`) y no existe
  `/alumno/mensajes`. Si el chat de alumnos entra en alcance, son 3 cambios coordinados —
  **no está en este plan**.
- **`SUPER_ADMIN` tampoco tiene `MESSAGING_*`** (`permissions.ts:89-156`). Recibiría 403
  en `/conversations`. Verificar si es deliberado o un olvido, aparte de este plan.
- `Conversation.groupId` / `subjectId` / `title` nunca se escriben, y `ConversationType.GROUP`
  está declarado pero no implementado (el broadcast usa fan-out a hilos DIRECT). No
  estorban, pero no confiar en ellos.
- Las cookies de auth no son `httpOnly` (`auth.ts:41`) → el token es robable por XSS. Es
  preexistente y fuera de alcance aquí, pero el socket hereda la exposición.
