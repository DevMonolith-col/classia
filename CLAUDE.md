# Classia SaaS

SaaS escolar multi-tenant: cada colegio es un tenant independiente, con sus propios
usuarios, estudiantes, acudientes, profesores, notas, asistencia, comunicados y branding.
No es una app para un solo colegio — si un diseño asume colegio único, está mal.

**Estado real del proyecto:** `docs/planning/estado-del-proyecto.md`. Está auditado contra
el código, no escrito de memoria, y distingue lo que funciona de lo que es maqueta. Varias
pantallas están construidas visualmente pero no llaman a la API. Consúltalo antes de asumir
que algo funciona, y corrígelo (con fecha) si encuentras que quedó desactualizado.

## Aislamiento multi-tenant

Hay **Row-Level Security de Postgres activo**, no solo filtros en el código. Eso cambia
cómo se escribe backend acá:

- **La app corre con `DATABASE_URL_APP`** (rol `classia_app`, sin superuser). `DATABASE_URL`
  (rol `classia`, superuser y dueño de las tablas) es **solo** para `prisma migrate`. Un
  superuser ignora RLS sin excepción — ni `FORCE ROW LEVEL SECURITY` lo cambia — así que
  usarlo en runtime convierte todo el aislamiento en un no-op silencioso: las políticas
  existen, `tsc` compila, todo parece correcto y ninguna fila está protegida. Por eso
  `DATABASE_URL_APP` es **obligatoria** desde el 2026-07-26 y ya no cae a `DATABASE_URL`: si
  falta, el API no arranca. Si un despliegue nuevo falla al levantar quejándose de ella, eso
  es el comportamiento correcto, no un bug.
- **Nunca `prisma.$transaction(...)` crudo** — usa `runInTenantTransaction()`
  (`apps/api/src/core/prisma/run-in-tenant-transaction.ts`). Una transacción cruda toma otra
  conexión del pool y pierde `app.tenant_id`. RLS falla cerrado, así que el síntoma no es una
  fuga sino "la feature devuelve cero filas". Una regla de ESLint lo bloquea, con 3
  excepciones ya auditadas.
- **Lectura cross-tenant de verdad** (dashboards de `SUPER_ADMIN`, bandeja de soporte,
  y login/refresh — que corre sin JWT y por tanto sin tenant conocido):
  `PlatformAdminPrismaService.get()`, un rol Postgres con `BYPASSRLS`. Cada uso afirma
  explícitamente "esto necesita ver todos los colegios" y debe justificarse por el nombre del
  método. Si el problema real es que falta contexto de tenant, la salida es `runWithTenant`,
  no el bypass.
- **Un modelo nuevo tenant-owned necesita `tenantId` propio** + `ENABLE` y `FORCE ROW LEVEL
  SECURITY`. `tenantId` ya está desnormalizado en 21 tablas que antes se protegían solo vía
  el padre (votos de elecciones, mensajes de conversación, comentarios de tickets), para que
  todas sigan la misma política simple en vez de una política por-join distinta cada vez.
  Los seeds también lo exigen ahora.

Verificación exhaustiva: `pnpm verify:rls`. El procedimiento paso a paso (agregar un modelo,
escribir la política, jobs de BullMQ, diagnosticar "cero filas") está en el skill
`rls-multitenant`. Las 7 trampas conocidas, con la prueba en vivo que confirmó cada una:
`docs/planning/aislamiento-rls-multitenant.md`.

RLS defiende contra "me olvidé el filtro", no contra "resolví el tenant equivocado" río
arriba. El scoping por rol (el acudiente solo ve sus hijos, el profesor solo sus grupos)
sigue siendo responsabilidad del código: `apps/api/src/common/permissions/permissions.ts`.

## Gotchas que cuestan una hora si no se saben

- **No existe `apps/mobile`.** Solo hay `apps/api` y `apps/web`. La app Expo **sigue en el
  roadmap sin fecha** (no está descartada), pero hoy no hay nada que mantener ni con qué
  guardar paridad: no escribas código "para cuando exista". Las variables `EXPO_PUBLIC_*` de
  `.env.example` están ahí por eso, sin usarse todavía.
- **Postgres local está en el puerto 5434**, no 5432 (`docker-compose.yml`).
- El tenant se resuelve por header `x-tenant-slug` en desarrollo y por hostname en producción.
- Las notas (`Mark`) tienen cuatro caminos de escritura y solo uno hace todo bien. Dos se
  saltan la auditoría, la notificación al alumno y el `academicYearId` — y sin ese campo la
  nota es invisible y no cuenta para el boletín. Antes de tocar calificaciones, usar el skill
  `calificaciones`; tiene frontera estricta con el dominio de notas/boletines.
- El login tiene rate-limit a propósito; los e2e corridos en ráfaga pegan contra él.
- Las notificaciones in-app se crean como fila `Notification` directa y solo el canal EMAIL
  genera `NotificationDelivery`. Es asimétrico — tenerlo en cuenta al agregar PUSH o WS.

## Comandos

```bash
docker compose up -d                              # postgres, redis, minio
pnpm --filter @classia/database db:migrate
pnpm --filter @classia/database seed:demo
pnpm dev                                          # web (3000) + api (3001)
pnpm -r typecheck && pnpm lint
pnpm --filter api test:e2e                        # obligatorio si tocas auth/tenants/permisos/auditoría
pnpm verify:rls
```

## Alcance del producto

Estas áreas **no** están aprobadas y no deben implementarse sin decisión del dueño del
producto: transporte, biblioteca, enfermería, nómina, IA, biometría, firma digital avanzada.

**Pagos — la frontera es fina y vale leerla.** Lo que existe (módulo `payments`,
`/admin/pagos`) es **cartera**: conceptos de cobro, facturas, y el registro manual de un pago
que la familia hizo por fuera. `PaymentMethod` (`CASH`/`TRANSFER`/`CARD`/`OTHER`) describe
cómo pagó afuera, y `Payment.recordedById` es quien lo anotó. Por Classia no pasa dinero.
**Recaudar en línea no está aprobado** — nada de pasarela, PSE, débito automático ni
tokenización de tarjetas. Eso arrastra alcance PCI, conciliación, reversiones y facturación
electrónica DIAN, y es una decisión aparte. Si una tarea empieza a pedir un webhook de
proveedor de pagos, ahí está el límite.

Aprobado explícitamente: **chat en tiempo real estilo WhatsApp** (2026-07-16), alcance
completo — entrega en vivo, "escribiendo...", presencia, checks de leído, adjuntos, silenciar
hilos. **Terminado el 2026-07-26**, las siete fases de `docs/planning/chat-tiempo-real.md`.
Las llamadas de voz/video **no** están aprobadas, y los botones decorativos que las insinuaban
se borraron ese mismo día: si vuelven a aparecer botones de llamada en la UI, es un error.

Aprobado explícitamente: **módulo de calendario** (2026-07-26, terminado ese mismo día),
alcance completo de las fases 1-5 de `docs/planning/calendario.md` — modelo `Event` real, UI de admin conectada,
agregación multi-fuente de las seis fuentes de fechas que ya existen, portales de
familia/profesor/alumno con recordatorios, y feed ICS suscribible de solo lectura. La
**sincronización bidireccional con Google Workspace / Microsoft 365 no está aprobada**: es
plugin de pago posterior (`docs/planning/plugins.md` §2 Módulo C), no parte del core.
Tampoco están aprobadas la reserva de recursos (aulas, buses — Transporte además está en la
lista de arriba) ni nada que invite a **pagar** desde el calendario: mostrar que el 14 de
agosto vence la pensión es cartera y está dentro; un botón de pago cruza la frontera de
pagos.

Datos de menores, calificaciones, asistencia y comunicaciones institucionales están de por
medio, con retención obligatoria por Ley 1620 y Ley 527 (de ahí el soft-delete que conserva
la fila en mensajería). Las acciones sensibles se auditan vía `AuditService`, y las
notificaciones push no deben llevar información sensible completa.
