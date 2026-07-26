# Plan: Módulo de Calendario

> Plan técnico y de producto para el módulo de calendario. La auditoría del punto de
> partida (§1) se hizo leyendo el código real de `main` el 2026-07-22 — cada afirmación
> de "existe" / "no existe" se verificó abriendo el archivo, no de memoria.
> **No se ha implementado nada de lo aquí descrito todavía.**
>
> **Re-verificado el 2026-07-26**, afirmación por afirmación, contra `main`: §1 sigue
> siendo exacta (modelo `Event` de 6 campos, página única y 100% mock, sin `PATCH`,
> `EVENTS_READ` usado en cero rutas, cero seed, cero cobertura e2e, y las seis fuentes de
> fechas con los campos que enumera). En esa pasada se le agregó §7.7 (RLS, que el plan
> no mencionaba en ninguna de sus 567 líneas originales) y el backfill explícito de §5.
>
> Las referencias de línea a `schema.prisma` se reemplazaron por nombres de modelo: se
> habían corrido ~50 líneas desde el 2026-07-22 y volverían a hacerlo. Las de
> `admin/calendario/page.tsx` se conservan porque se verificaron vigentes y son la
> evidencia concreta de que la página es una maqueta.
>
> **§0 y las seis decisiones de §9 quedaron resueltas el 2026-07-26** — el módulo está
> aprobado con alcance completo (fases 1-5) y así quedó anotado en `CLAUDE.md`. Las
> respuestas están al pie, en §9; dos de ellas cambian §5 y la Fase 1, y ya están
> incorporadas ahí. No hay que volver a preguntarlas.
>
> La sección §2 (panorama de mercado) es conocimiento general del sector, no auditoría de
> código ajeno. Los detalles de proveedores LatAm están marcados como *a verificar* donde
> la afirmación es más débil.

---

## 0. Estado de aprobación — **resuelto el 2026-07-26**

> **Aprobado con alcance completo** (fases 1-5): núcleo interno, agregación multi-fuente,
> portales de familia/profesor/alumno con recordatorios y feed ICS. Anotado en `CLAUDE.md`
> con fecha, junto con las tres fronteras que el módulo roza y que **no** están aprobadas:
> sync bidireccional con Google/Microsoft (plugin de pago posterior), reserva de recursos, y
> cualquier cosa que invite a pagar desde el calendario.
>
> Lo que sigue es el texto original de la sección, que explica por qué era bloqueante.

`CLAUDE.md` (§Alcance del producto) mantiene dos listas explícitas: lo que **no** está
aprobado (transporte, biblioteca, enfermería, nómina, IA, biometría, firma digital
avanzada) y lo que sí, con fecha (chat en tiempo real, 2026-07-16). **El calendario no
está en ninguna de las dos.**

O sea que este plan describe un módulo cuya aprobación no está registrada en ninguna
parte. No está prohibido, pero tampoco autorizado, y el repo es deliberadamente estricto
con eso: hay áreas donde una decisión de producto faltante convierte semanas de trabajo en
alcance no aprobado.

**Antes de la Fase 1 —y antes incluso de las seis decisiones de §9— hay que resolver si el
módulo se hace y con qué alcance.** Si la respuesta es sí, anotarlo en `CLAUDE.md` con
fecha, en el mismo formato que el chat, para que la próxima sesión no tenga que volver a
preguntarlo.

Ojo con dos fronteras que este plan roza y que ya están decididas en `CLAUDE.md`:

- **Reserva de recursos** (aulas, buses) queda fuera: transporte requiere aprobación
  explícita, que no tiene. Ya está declarado como anti-objetivo en §4.
- **Los vencimientos de cobros** que la agregación de §1.5 quiere mostrar son de cartera
  (`FeeConcept`, `Invoice`), no de recaudo en línea. Mostrar "el 14 de agosto vence la
  pensión" es una lectura de cartera y está dentro de lo aprobado; cualquier cosa que
  invite a **pagar** desde el calendario cruza la frontera de pagos, que no está aprobada.

---

## 1. Punto de partida (auditado)

### 1.1 Frontend: una sola página, 100% mock

`apps/web/app/admin/calendario/page.tsx` es **la única página de calendario del
proyecto**. Es un prototipo visual competente y completamente desconectado:

| Síntoma | Evidencia |
|---|---|
| Datos hardcodeados | `mockEvents` con 10 eventos, `page.tsx:34` |
| Fechas de 2024 | Todos los eventos son de **febrero de 2024** |
| "Hoy" congelado | `useState(new Date(2024, 1, 12))` (`:51`), botón "Hoy" vuelve a esa fecha (`:206`), y el resaltado es literalmente `day === 12 && currentDate.getMonth() === 1` (`:264`, `:319`) |
| Botones muertos | "Nuevo Evento" (`:138`), "Editar" y "Eliminar" (`:434-435`) no tienen `onClick` |
| Cero red | No hay `fetch`, ni import de `api-client` |

Lo que **sí** funciona (y es reutilizable): navegación mes/semana, filtro por tipo,
grilla mensual, vista semanal, modal de detalle. El andamiaje visual está hecho.

No existe página de calendario para profesor, acudiente ni alumno. En `/familia` el card
"Próximos Eventos" es otro array hardcodeado y su botón "Ver calendario"
(`apps/web/app/familia/page.tsx:321`) apunta a `/familia/horario`, que también es mock.

### 1.2 Backend: existe, es sano, y es más pobre que la UI

El módulo `apps/api/src/modules/events/` está bien construido dentro de su alcance:
scoping por tenant correcto (`resolveTenantScope`), auditoría en create/delete, Zod en
los DTOs. El problema es que su alcance es mínimo.

| Endpoint | Estado |
|---|---|
| `GET /events` | ✅ existe — **pero solo devuelve futuros**: `date: { gte: query.from ?? new Date() }` (`events.service.ts:22`), sin parámetro `to`, `limit` default **5** / máximo **50** (`events.schemas.ts:15`) |
| `POST /events` | ✅ |
| `DELETE /events/:id` | ✅ |
| `PATCH /events/:id` | ❌ **no existe** — el botón "Editar" de la UI no tiene backend al que llamar |

El modelo `Event` (`schema.prisma`, modelo `Event`) tiene **6 campos**:

```prisma
model Event {
  id        String   @id @default(uuid())
  tenantId  String
  title     String
  date      DateTime
  location  String?
  createdAt DateTime @default(now())
}
```

La UI ya asume `startTime`, `endTime`, `type`, `description`, `attendees` y `color`.
**Ninguno existe en la base de datos.** El desfase no es de cableado: es de modelo.

### 1.3 Permisos: el calendario escolar que las familias no pueden ver

`EVENTS_CREATE/LIST/READ/DELETE` solo están asignados a 5 de los 10 roles
(`permissions.ts`, verificado recorriendo los bloques):

| Tiene permisos | No tiene ninguno |
|---|---|
| `SUPER_ADMIN`, `TENANT_ADMIN`, `PRINCIPAL`, `COORDINATOR`, `SECRETARY` | `TEACHER`, `GUARDIAN`, `STUDENT`, `SUPPORT_AGENT`, `SUPPORT_SUPERVISOR` |

Además `EVENTS_READ` está declarado pero **ninguna ruta lo usa** (grep sobre
`apps/api/src` excluyendo `permissions.ts`: cero resultados), y no existe
`EVENTS_UPDATE`.

### 1.4 Sin datos y sin pruebas

- Cero eventos en el seed de `packages/database`.
- Cero cobertura de `events` en `apps/api/test/backend-v1.e2e-spec.ts` (los hits de
  "event" en ese archivo son `NotificationEventType`, no el módulo de eventos).

### 1.5 Los seis calendarios que ya existen y nadie ve juntos

Este es el hallazgo más importante de la auditoría. El sistema **ya tiene seis fuentes
de fechas** en producción, y ninguna llega al calendario:

| Fuente | Modelo | Campos de fecha |
|---|---|---|
| Clases | `Schedule` | `dayOfWeek` + `startTime`/`endTime` (strings) — recurrencia semanal implícita |
| Tareas y exámenes | `Homework` | `availableFrom`, `dueDate`, `cutOffDate` |
| Año y periodos | `AcademicYear`, `AcademicPeriod` | `startDate`, `endDate` |
| Cobros | `FeeConcept`, `Invoice` | `dueDate` (cartera, **no** recaudo — ver §0) |
| Gobierno escolar | `Election` | `startDate`, `endDate` |
| Asistencia | `AttendanceSession` | sesión por fecha |

Un colegio que quiera saber "¿qué pasa la semana del 3 de agosto?" hoy tiene que abrir
cinco pantallas distintas. **Ese es el producto real que falta, no un CRUD de eventos.**

### 1.6 Activos que juegan a favor

| Activo | Dónde | Por qué importa |
|---|---|---|
| `Tenant.timezone` | `schema.prisma`, modelo `Tenant`, default `America/Bogota` | El campo más difícil de retro-agregar en un calendario ya existe |
| BullMQ con jobs repetibles | `reports.service.ts`, `access-session-expiry.processor.ts` | Los recordatorios de eventos no necesitan infra nueva |
| Notificaciones multicanal | `notifications.service.ts#notify`, enum `NotificationEventType`, preferencias por usuario/canal | Agregar `EVENT_*` es sumar un valor al enum, no construir un sistema |
| Patrón de audiencia ya resuelto | `Announcement.targetRole` + `groupId`, filtrado en `announcements.service.ts:38-39` | Copiar este patrón exacto evita inventar un modelo de visibilidad nuevo |
| Grilla mes/semana ya diseñada | `admin/calendario/page.tsx:249-356` | El trabajo de UI es conectar y extraer, no diseñar |

Y un lastre conocido: `profesor/horario` y `familia/horario` **duplican ~70% de su
código de calendario entre sí** y ambos son mock
(`docs/planning/frontend-unificacion-roles.md:54-59`). Si el calendario se construye sin
un componente compartido, esa duplicación pasa de 2 a 5 copias.

---

## 2. Qué hacen las otras apps

Hay cuatro estrategias en el mercado, y no son excluyentes — las buenas plataformas
combinan la 1 con la 2 y la 4.

### Estrategia A — Calendario interno, cerrado

El calendario vive solo dentro del portal. Sin exportación, sin sincronización.

- **Quién**: la mayoría de las plataformas escolares de LatAm y España — Ciudad
  Educativa, Master2000, Q10, Alexia, Educamos (SM), Idukay, Additio. *(Caracterización
  general del mercado; el detalle por proveedor conviene verificarlo antes de citarlo en
  material comercial.)*
- **Por qué lo hacen**: es lo más barato, y el colegio es el cliente que paga — no la
  familia. La presión por integrarse es baja.
- **El costo real**: nadie vive dentro de tu app. Un padre revisa su calendario del
  teléfono 20 veces al día y el portal del colegio una vez al mes. Un evento que solo
  existe en tu portal, para efectos prácticos, **no fue comunicado**. Es la razón por la
  que los colegios terminan duplicando todo por WhatsApp.

### Estrategia B — Interno + feed ICS de solo lectura (el estándar de facto)

El sistema publica una URL `webcal://`/`https://` que devuelve un archivo iCalendar
(RFC 5545), personalizada por usuario y protegida con un token secreto. El usuario la
pega una vez en Google Calendar, Apple Calendar u Outlook y **el calendario del colegio
aparece dentro del calendario que ya usa**, actualizándose solo.

- **Quién**: Canvas LMS ("Calendar Feed"), Moodle (exportación iCalendar con token por
  usuario), Schoology, PowerSchool, Blackbaud. Es lo que hace prácticamente todo el
  mundo anglosajón.
- **Por qué gana**: cubre Google, Apple y Microsoft **con una sola implementación** y sin
  OAuth, sin credenciales de terceros, sin cuotas de API, sin verificación de marca.
- **La limitación aceptada a propósito**: es unidireccional. El colegio manda; el
  calendario personal solo refleja. Y eso es exactamente lo que se quiere en un sistema
  con obligaciones de auditoría — nadie puede "editar" el calendario oficial desde su
  teléfono.
- **Detalle operativo**: los clientes externos refrescan cuando quieren. Google Calendar
  puede tardar horas en traer un cambio. Para "el examen se movió a mañana" el canal es
  la notificación push/email, no el feed.

### Estrategia C — Sincronización bidireccional OAuth con Google / Microsoft

El colegio conecta su Google Workspace for Education (o Microsoft 365) y los eventos se
escriben como eventos reales en los calendarios de Google.

- **Quién**: Google Classroom lo hace nativamente (crea un calendario por clase y mete
  ahí las tareas con fecha). Microsoft Teams for Education equivalente. Algunos SIS de
  gama alta lo ofrecen como módulo.
- **Cuándo vale la pena**: cuando el colegio **ya es** Google Workspace for Education —
  algo muy común en colegios privados de Colombia — y todo el personal vive en Gmail.
  Ahí la UX es imbatible: el evento aparece sin que nadie se suscriba a nada.
- **Lo que cuesta de verdad** (y por qué casi nadie lo hace en la v1):
  - OAuth por tenant con `refresh_token` cifrado en reposo, rotación y revocación.
  - Verificación de la app ante Google: los scopes de Calendar API son **sensibles**, lo
    que exige proceso de verificación de marca (no la auditoría de seguridad anual de los
    scopes *restricted* tipo Gmail, pero sí semanas de trámite). **A verificar contra la
    política vigente de Google antes de comprometer fechas.**
  - Reconciliación: ¿qué pasa si alguien borra el evento en Google? ¿si lo edita? ¿si el
    colegio revoca el token? Cada respuesta es una decisión de producto y un caso de
    soporte.
  - Cuotas y rate limits por proyecto, compartidos entre **todos** los tenants.
  - Un colegio con Microsoft y otro con Google significa **dos** integraciones, no una.
- **El punto ciego**: resuelve el problema del *personal del colegio*, no el de las
  *familias*. Los padres de un colegio Google Workspace no tienen cuenta del dominio —
  siguen necesitando la Estrategia B.

### Estrategia D — El calendario como vista agregada, no como tabla

La decisión de arquitectura que más diferencia a un calendario bueno de uno mediocre: el
calendario **no es una tabla de eventos**, es una proyección de todo lo que ya tiene
fecha en el sistema.

- **Quién**: Canvas (las `assignments` aparecen solas en el calendario, nadie las crea
  dos veces), Google Classroom (toda tarea con fecha va al calendario del curso), Moodle
  (eventos de curso, de actividad, de usuario y de sitio en una sola vista).
- **Por qué importa aquí**: Classia ya tiene las seis fuentes de §1.5. La versión
  agregada no requiere que nadie capture datos nuevos — el valor sale de datos que ya
  están en la base.
- **Consecuencia de diseño**: las fuentes derivadas son **solo lectura** en el
  calendario. Una entrega de tarea se edita en el módulo de tareas, no en el calendario.
  Esto evita duplicar la lógica de permisos de cinco módulos dentro de uno.

### Resumen comparativo

| | A: interno cerrado | B: interno + ICS | C: OAuth bidireccional | D: vista agregada |
|---|---|---|---|---|
| Costo de construcción | Bajo | **Bajo-medio** | Alto | Medio |
| Costo de operación/soporte | Bajo | Bajo | **Alto y permanente** | Bajo |
| Llega al teléfono del papá | ❌ | ✅ | Solo si tiene cuenta del dominio | n/a |
| Funciona sin cuenta Google/MS | ✅ | ✅ | ❌ | ✅ |
| Fuente de verdad auditable | ✅ | ✅ | ⚠️ se difumina | ✅ |
| Monetizable como plugin | ❌ | ❌ | ✅ | ❌ |
| Dependencia de terceros | Ninguna | Ninguna | Alta | Ninguna |

---

## 3. Qué conviene para Classia

**Recomendación: núcleo 100% interno + agregación multi-fuente + feed ICS de solo
lectura. Google/Microsoft bidireccional queda como plugin de pago posterior, no como
parte del core.** Es decir: **D + B ahora, C después y cobrando.**

Los seis argumentos, en orden de peso:

1. **La fuente de verdad tiene que ser Classia, por obligación.** El proyecto ya lleva
   auditoría de acciones sensibles como regla obligatoria (`CLAUDE.md`, vía `AuditService`)
   y aplica soft-delete por Ley 1620 / Ley 527 en mensajería y comunicados
   (`Announcement.deletedAt`). Un calendario cuya fuente de verdad esté en la cuenta de Google
   de un colegio no es auditable ni retenible. Google puede ser un *espejo*; nunca el
   original.

2. **Cobertura de las familias, que es el usuario que importa.** Un colegio en Colombia
   puede ser Google Workspace para su personal, pero sus acudientes son un universo
   mezclado de Gmail personal, Hotmail y teléfonos con poco más que WhatsApp. La
   Estrategia C no los alcanza. La B sí, y sin pedirles crear nada.

3. **Relación costo/beneficio brutal a favor de ICS.** Un feed ICS es aproximadamente
   *un archivo de texto bien formado más un token* y cubre Google, Apple y Outlook
   simultáneamente. Una sync OAuth bidireccional es semanas de trabajo, trámite de
   verificación con Google, y una fuente permanente de tickets. El 90% del valor
   percibido ("lo veo en mi celular") lo entrega el 5% del esfuerzo.

4. **Construir la sync en el core destruye un producto que ya está planeado para
   cobrar.** `docs/planning/plugins.md` §2 Módulo C ya define "Google Workspace for
   Education Sync" como plugin monetizable con OAuth 2.0 por tenant. Regalarlo dentro del
   calendario base elimina ese diferenciador comercial antes de venderlo una sola vez.

5. **El valor real y no copiado está en la agregación, no en la integración.** Cualquiera
   se conecta a Google Calendar. Muy pocos le muestran a un coordinador, en una sola
   grilla, que el 14 de agosto coinciden el cierre de notas del periodo, tres entregas de
   tareas de 11°, el vencimiento de pensión y la jornada de elecciones de personero.
   **Eso** es lo que ningún calendario externo puede darles, porque los datos son de
   Classia.

6. **Riesgo de soporte asimétrico.** La sync bidireccional genera la peor clase de
   ticket: el irreproducible. "Borré el evento en Google y volvió a aparecer",
   "se desincronizó", "el token expiró y nadie se enteró en tres semanas". Con un equipo
   pequeño, ese costo se paga todos los meses, para siempre.

### Cuándo revisitar la Estrategia C

Vale la pena reabrir la decisión — como plugin, con precio — cuando se cumpla alguna de
estas condiciones, no antes:

- Tres o más tenants la piden explícitamente por escrito.
- Un contrato grande la pone como requisito de cierre.
- El feed ICS ya está en producción y las métricas muestran adopción alta (señal de que
  la demanda de "verlo en mi calendario" es real y da para más).

Y si se hace: **de una sola vía primero** (Classia → Google), que cubre el 80% del caso
de uso con una fracción del riesgo de la bidireccional.

---

## 4. Anti-objetivos (lo que este plan decide NO hacer)

Declararlos evita que reaparezcan como "pero sería fácil agregar…" en cada revisión:

| No haremos | Por qué |
|---|---|
| Sync bidireccional con Google/Microsoft en el core | §3.4 — es plugin de pago, no base |
| Reemplazar Google Classroom como LMS | Fuera de alcance; el conector Moodle/Classroom vive en `plugins.md` |
| Recurrencia arbitraria (RRULE completo) en v1 | §7.2 — costo alto, demanda real baja; el horario de clases ya cubre la recurrencia que de verdad se usa |
| Invitaciones con RSVP / confirmación de asistencia estilo Outlook | Producto distinto. El campo `attendees` de la UI mock es un número decorativo, no una lista de invitados |
| Reserva de recursos (aulas, laboratorios, buses) | Módulo aparte; Transporte además requiere aprobación explícita (`CLAUDE.md`, §Alcance del producto) |
| Que el calendario permita editar tareas, notas o facturas | §2.D — las fuentes derivadas son solo lectura; se editan en su propio módulo |

---

## 5. Modelo de datos propuesto

Cambio sobre `Event`. Se mantiene el nombre de tabla (`events`) para no romper lo
existente. **La migración NO es puramente aditiva** — ver el backfill obligatorio más
abajo, que es la parte que más fácil se pasa por alto y la que ya costó un bug de nueve
días en este repo.

```prisma
enum CalendarEventType {
  ACADEMICO        // exámenes, cierre de notas, entrega de boletines
  INSTITUCIONAL    // izadas de bandera, festival cultural
  REUNION          // consejo directivo, escuela de padres
  ADMINISTRATIVO   // matrículas, simulacros
  FESTIVO          // festivo nacional o día no lectivo del colegio
}

model Event {
  id          String            @id @default(uuid())
  tenantId    String
  title       String
  description String?
  type        CalendarEventType @default(INSTITUCIONAL)

  startsAt    DateTime          // era `date`. Siempre UTC.
  endsAt      DateTime          // obligatorio; para allDay = fin del día en la tz del tenant
  allDay      Boolean           @default(false)

  location    String?

  // Audiencia — mismo patrón exacto que Announcement (announcements.service.ts:38-39)
  targetRole  UserRole?         // null = todos los roles
  groupId     String?           // null = todo el colegio

  // Marca los días en que no hay clase. Lo consume asistencia, no solo la grilla.
  isSchoolDayOff Boolean        @default(false)

  // §9.5: antelación del recordatorio, por evento. null = sin recordatorio.
  reminderMinutesBefore Int?

  createdById String?           // §5.1: nullable — null = creado antes de que se registrara el autor
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  deletedAt   DateTime?         // soft-delete, coherente con Announcement

  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  group     Group?  @relation(fields: [groupId], references: [id])
  createdBy User?   @relation(fields: [createdById], references: [id])

  @@index([tenantId, startsAt])
  @@index([tenantId, groupId, startsAt])
  @@map("events")
}
```

Decisiones incorporadas y su razón:

- **`startsAt`/`endsAt` en vez de `date` + strings de hora.** `Schedule` guarda
  `startTime`/`endTime` como `String` (ver el modelo `Schedule`) porque una clase es una
  plantilla semanal sin fecha; un evento sí es un instante y debe ser `DateTime` para que
  los rangos, el ordenamiento y el ICS funcionen sin parsing manual.
- **`allDay` explícito.** "Día del Maestro" no tiene hora; sin esta bandera, un evento
  guardado a medianoche UTC se muestra el día anterior para cualquiera al oeste de
  Greenwich — incluida toda Colombia (UTC-5). Es el bug clásico de calendarios y es
  barato prevenirlo ahora.
- **`endsAt` obligatorio.** Nullable obliga a un `?? startsAt` disperso en toda la UI, el
  ICS y las consultas de solapamiento.
- **Audiencia copiada de `Announcement`, no inventada.** El filtro ya está escrito y
  probado en `announcements.service.ts:38-39`; reusar la forma permite reusar el código.
- **`isSchoolDayOff`.** Es el gancho que le da valor operativo real al calendario más
  allá de lo informativo: asistencia no debería abrir sesión un día marcado como no
  lectivo, y las fechas de entrega no deberían caer ahí. Se agrega el campo ahora aunque
  su consumo llegue después.
- **`createdById` y `updatedAt`.** Hoy no se sabe quién creó un evento; con auditoría
  como regla obligatoria del proyecto, es una omisión. Desde §9.2 además es funcional y no
  solo forense: un profesor edita y borra únicamente los eventos que creó. Queda **nullable**
  por §5.1 — inventarle un autor a las filas viejas sería peor que admitir que no se sabe.
- **`reminderMinutesBefore`** entra por §9.5 (recordatorio configurable por evento). Es un
  `Int?` y no una tabla aparte porque hay un recordatorio por evento, no varios; si algún día
  se piden múltiples, ahí sí toca tabla. `null` significa "sin recordatorio", que es distinto
  de `0`.
- **`deletedAt`.** Coherente con el criterio de retención ya aplicado a comunicados y
  mensajería.
- **Sin `color` en la base de datos.** El color se deriva de `type` en el frontend. Un
  color persistido es un dato de presentación en la capa equivocada y garantiza
  inconsistencias entre web, futuro móvil y el ICS.
- **`startTime`/`endTime` de `Schedule` son `String` a propósito** y no hay que imitarlo:
  una clase es una plantilla semanal sin fecha, un evento es un instante.

### 5.1 El backfill, que no es opcional

La tabla `events` **ya existe** y puede tener filas en cualquier base que no sea de dev.
Tres de los cambios propuestos no se pueden aplicar sin decidir qué pasa con esas filas:

| Cambio | Por qué no es aditivo | Backfill |
|---|---|---|
| `date` → `startsAt` | Renombre, no columna nueva | `ALTER TABLE ... RENAME COLUMN` preserva los datos. Recrear el índice `(tenantId, startsAt)` y **borrar** el viejo `(tenantId, date)` |
| `endsAt` **NOT NULL** | No hay valor previo del que derivarlo | Rellenar con `startsAt` (evento puntual) o con el fin del día en la tz del tenant si se decide `allDay = true` para lo preexistente. Agregar la columna nullable → backfill → recién ahí `SET NOT NULL` |
| `createdById` **NOT NULL** | Nadie registró quién creó los eventos viejos | No hay dato real que poner. Las opciones honestas son dejarla **nullable** (y que `null` signifique "creado antes de que se registrara el autor") o hacerla NOT NULL con backfill al usuario `TENANT_ADMIN` del tenant, que **inventa un autor falso**. Recomendación: nullable, y documentar el significado del `null` |

**Por qué esto tiene su propia sección:** el 2026-07-16 se agregó `Mark.academicYearId` a
una tabla con filas, sin backfill y sin default. Como todas las lecturas de notas filtran
por año, cada nota preexistente quedó **invisible** y sin contar para el boletín, con `200`
en el endpoint y sin un solo error en los logs. El bug vivió nueve días y necesitó su
propia migración de reparación (`20260725120000_backfill_mark_academic_year`). Una columna
nueva sobre una tabla con datos es una decisión de datos, no un cambio de schema.

Corolario para `endsAt`: **agregar la columna como nullable y hacerla NOT NULL en un
segundo paso, dentro de la misma migración**, después del `UPDATE` de backfill. Postgres
rechaza `ADD COLUMN ... NOT NULL` sin default sobre una tabla no vacía, así que el atajo
falla ruidosamente en producción y silenciosamente en dev, donde la tabla está vacía —
la peor combinación posible.

---

## 6. Fases

Estimaciones relativas y en días de trabajo enfocado, con la imprecisión habitual. Las
fases 1-2 son el mínimo para que la página deje de mentir; la 3 es donde está el valor
diferencial; la 5 es el mayor retorno por esfuerzo de todo el plan.

### Fase 0 — Decisiones de producto *(bloqueante, ver §0 y §9)*

No es trabajo de código. Empieza por §0 —si el módulo está aprobado y con qué alcance— y
sigue con las seis preguntas de §9. Sin esas respuestas la Fase 1 se construye sobre
supuestos, y la §9.2 en particular (si un profesor puede crear eventos para su grupo)
cambia el modelo de permisos, no una bandera.

---

### Fase 1 — Modelo y backend del calendario interno · **M** (~3-4 días) · ✅ hecha el 2026-07-26

> Implementada en `20260726130000_calendar_event_model` + `apps/api/src/modules/events/`.
> Lo que se aprendió y no estaba previsto acá:
>
> - **`updatedAt` cae en la misma trampa que `endsAt`.** §5.1 solo señalaba `endsAt`, pero
>   `@updatedAt` también se emite como `ADD COLUMN ... NOT NULL` sin default, así que también
>   necesita nullable → backfill (con `createdAt`, no `now()`) → `SET NOT NULL`.
> - **`prisma migrate dev` no es usable en este repo**: se cuelga replicando 40 migraciones en
>   la shadow database. El SQL va a mano y se verifica con `prisma migrate diff
>   --from-schema-datamodel ... --to-schema-datasource ...`, que no la necesita.
> - **El backfill se probó con una fila de verdad.** En dev `events` está vacía, así que el
>   atajo pasa igual; se insertó una fila sintética antes de migrar y se confirmó que
>   `ADD COLUMN ... NOT NULL` la rechaza con una fila y la acepta con la tabla vacía. Es
>   literalmente lo que §5.1 advertía, ahora comprobado y no supuesto.
> - **`GET /events` tenía un consumidor real** que §1.1 no cubría: el dashboard de admin llama
>   `/events?limit=4` (`apps/web/app/admin/page.tsx`). Hacer `from`/`to` obligatorios sin más
>   le habría devuelto 400 en producción, así que el endpoint quedó con dos modos (rango para
>   la grilla, "próximos N" para el widget). Ese dashboard además leía `date`, que ahora es
>   `startsAt`: se corrigió en el mismo cambio.
> - **`allDay` se normaliza desde la fecha civil UTC, no desde la hora de pared local.** La
>   primera versión interpretaba el instante en la zona del colegio, y como una fecha se
>   serializa a medianoche UTC, "2026-05-15" quedaba guardado el 14 — el bug que la bandera
>   existe para prevenir. Lo destapó el test.
> - **Bug encontrado en la aritmética de zonas horarias que ya existía**: `tzOffsetMs`
>   (extraída de `reports.recurrence.ts`) descartaba los milisegundos, así que el fin de un
>   día quedaba en `05:00:00.998Z` en vez de `04:59:59.999Z`. Era invisible porque su único
>   llamador pasaba siempre `00:00:00.000`.
> - **El cross-tenant devuelve 404, no 403.** RLS hace la fila invisible antes de que el
>   servicio compare tenants. Falla cerrado y no confirma que el id exista.
> - **Los 15 tests se verificaron revirtiendo el comportamiento que afirman, y 2 no fallaron.**
>   Los dos de aislamiento cross-tenant pasan igual con el `where: { tenantId }` quitado,
>   porque con RLS forzado la fila del otro colegio no existe para esa conexión: el filtro de
>   la aplicación **no es observable desde el API**. Quedan como regresión de la garantía (se
>   ponen rojos si se desactiva la política o si la app se conecta con el rol superuser), y se
>   agregó el chequeo que sí es app-level: `?tenantId=<ajeno>` debe dar **403**, no una lista
>   vacía — ese sí falla al revertirlo. Está anotado en el skill `rls-multitenant`, porque
>   aplica a cualquier test de aislamiento futuro de este repo. Los 13 restantes fallan al
>   revertirlos, incluidos los dos IDOR intra-tenant del profesor, que son los que RLS no
>   puede cubrir.

1. Migración Prisma del modelo de §5, **siguiendo §5.1 al pie de la letra**: el renombre
   `date` → `startsAt`, y `endsAt` agregada nullable → `UPDATE` de backfill → `SET NOT
   NULL`, en ese orden y dentro de la misma migración. `ADD COLUMN ... NOT NULL` sin
   default sobre una tabla con filas lo rechaza Postgres, y en dev la tabla está vacía, así
   que el atajo pasa en local y explota en producción. Decidir también si `createdById`
   queda nullable (recomendado) o se le inventa un autor.
2. `GET /events` **con rango real**: parámetros `from` y `to` obligatorios, ventana
   máxima acotada (p.ej. 400 días) para evitar consultas abusivas, `limit` fuera del
   camino de la grilla. El `date: { gte: now }` actual se elimina — un calendario tiene
   que poder mirar hacia atrás.
3. `PATCH /events/:id` + permiso nuevo `EVENTS_UPDATE` + auditoría `event.updated`
   siguiendo el patrón de `create`/`remove` que ya existe.
4. Filtro de audiencia en `list()` portando `announcements.service.ts:38-39`.
5. Permisos: dar `EVENTS_LIST`/`EVENTS_READ` a `TEACHER`, `GUARDIAN`, `STUDENT`.
   Cablear `EVENTS_READ` a un `GET /events/:id` real o eliminarlo — hoy es un permiso
   fantasma. Y por §9.2, `TEACHER` recibe `EVENTS_CREATE/UPDATE/DELETE` con el alcance
   impuesto en el servicio: `groupId` obligatorio validado contra los grupos que enseña, y
   edición/borrado limitados a lo que él creó.
6. Validación: `endsAt >= startsAt`; si `allDay`, normalizar a límites de día en
   `Tenant.timezone`.
7. E2E en `backend-v1.e2e-spec.ts`: aislamiento entre tenants, audiencia por rol y por
   grupo, rango, y que un `GUARDIAN` no vea un evento dirigido solo a `TEACHER`.
8. Seed con eventos realistas del calendario escolar colombiano. Ojo: los seeds exigen
   `tenantId` explícito desde la desnormalización de la Fase 1 de RLS.
9. `pnpm verify:rls` en verde después de la migración (§7.7). No es un paso de cierre
   opcional: es lo que detecta un modelo nuevo sin política.

**Criterio de terminado:** un `TENANT_ADMIN` crea, edita y borra eventos por API; un
`GUARDIAN` de otro tenant recibe 403 y uno del mismo tenant solo ve lo que le toca.
Los tests se verifican **revirtiendo el comportamiento que afirman**: un test de
aislamiento que pasa igual con el filtro de tenant quitado no está probando nada.

---

### Fase 2 — UI de admin conectada + componente compartido · **M** (~3-4 días) · ✅ hecha el 2026-07-26

> `components/shared/calendar/` (grilla + tipos) y `components/admin/event-form-dialog.tsx`.
> Verificado en el navegador contra la app corriendo, no solo con tests: se creó un evento,
> se recargó y seguía ahí; se editó; se borró y desapareció de la grilla mientras la fila
> quedaba en la base con `deletedAt`. Consola sin errores.
>
> Notas de implementación:
>
> - **El color no se persiste**, se deriva de `type` en `calendar-types.ts`. Un color en la
>   base es presentación en la capa equivocada y garantizaría que web, el futuro móvil y el
>   ICS se contradigan.
> - **Un evento de varios días aparece en todos sus días** (`groupEventsByDay`), no solo en el
>   primero. Sin eso, "semana de desarrollo institucional" se veía como un evento de un lunes.
> - **La navegación de mes fija el día 1 antes de mover el mes.** Sin eso, estando en un 31 el
>   botón "anterior" salta dos meses, porque JS desborda al mes siguiente cuando el destino
>   tiene 30 días.
> - **El fetch depende del rango, no de `currentDate`.** Navegar del 3 al 10 de agosto no
>   cambia el mes consultado, y sin esa distinción cada clic disparaba una consulta nueva.
> - El selector de audiencia usa un centinela `__any__`: Radix no admite `value=""`, y
>   "todo el colegio" es una opción real, no la ausencia de valor.

1. Extraer la grilla mes/semana de `admin/calendario/page.tsx` a
   `components/shared/calendar/` con props de datos. **Esto es un requisito, no una
   mejora**: `profesor/horario` y `familia/horario` ya duplican ~70% de su calendario
   entre sí (`frontend-unificacion-roles.md:54-59`) y las fases 4-5 agregan tres
   consumidores más.
2. Reemplazar `mockEvents` por la API, con `currentDate` inicializado en `new Date()` y
   `isToday` calculado de verdad.
3. Modal de creación/edición: título, tipo, fechas, todo-el-día, ubicación, descripción,
   audiencia (rol + grupo), no lectivo.
4. Borrado con confirmación.
5. Estados de carga, error y vacío — la página mock no tiene ninguno.

**Criterio de terminado:** un coordinador crea un evento en el navegador, recarga y sigue
ahí; la familia objetivo lo ve por API.

---

### Fase 3 — Agregación multi-fuente · **L** (~4-6 días) · *el diferencial*

`GET /calendar?from&to&sources=` devuelve una lista unificada y normalizada donde cada
ítem lleva `source`, `sourceId`, `editable: false` para lo derivado, y su deep link al
módulo dueño.

| Fuente | Se proyecta como | Visible para |
|---|---|---|
| `Event` | El evento | Según audiencia |
| `Homework.dueDate` | Entrega / examen | Alumno y acudiente del grupo; profesor autor; admin |
| `AcademicPeriod.startDate/endDate` | Banda de inicio/cierre de periodo | Todos |
| `Invoice.dueDate` / `FeeConcept.dueDate` | Vencimiento de pago | **Solo el acudiente dueño** y admin — nunca agregado por grupo |
| `Election.startDate/endDate` | Jornada de votación | Según el padrón de la elección |
| `Schedule` | Clases de la semana | Opcional y apagado por defecto: satura la grilla mensual |

Reglas no negociables:

- Cada fuente aplica **sus propios** permisos, no los del calendario. La agregación
  compone consultas ya autorizadas; no puede convertirse en un bypass. La proyección de
  facturas es el caso crítico: filtrar por acudiente, jamás por grupo.
- Todo lo derivado es solo lectura; el clic lleva al módulo dueño.
- El `sources` es opt-in por consulta para no pagar seis consultas cuando se necesita una.
- Cuidado con el N+1 — el precedente de `profesor/page.tsx` ya documentado
  (`estado-del-proyecto.md`) es exactamente el error a no repetir.

---

### Fase 4 — Lectura para familia, profesor y alumno + recordatorios · **M** (~3-4 días)

1. `/familia/calendario`, `/profesor/calendario`, `/alumno/calendario` sobre el
   componente compartido de la Fase 2, cada uno con sus fuentes por defecto.
2. Arreglar el card "Próximos Eventos" de `/familia` y repuntar su enlace.
3. Notificaciones: agregar `EVENT_PUBLISHED` y `EVENT_REMINDER` a
   `NotificationEventType`, con preferencia por usuario y canal (la infraestructura ya
   existe, `notifications.service.ts#notify`).
4. Job de recordatorios en BullMQ (24 h antes por defecto), siguiendo el patrón de
   `access-session-expiry.processor.ts`. **Con `jobId` saneado** — el bug de
   `41d86f5` en reportes (jobIds inválidos hacían que nada se agendara jamás) es el
   antecedente exacto a no repetir; `core/queue/job-id.ts` ya tiene el helper.

---

### Fase 5 — Feed ICS suscribible · **S-M** (~2-3 días) · *el mayor retorno del plan*

`GET /calendar/feed/:token.ics` → `text/calendar`, sin sesión, con el contenido filtrado
exactamente igual que si el dueño del token hubiera llamado a la API.

> **Leer §7.7 antes de empezar esta fase.** Corre sin JWT y sin `x-tenant-slug`, así que
> sin contexto de tenant explícito el feed devuelve **cero eventos** y no falla. Se
> resuelve el tenant desde el token y se envuelve todo en `runWithTenant` — **no** con el
> rol `BYPASSRLS`, que dejaría un endpoint público sin ninguna barrera debajo.

- Tabla `CalendarFeedToken`: `id`, **`tenantId`** (tenant-owned: lleva `ENABLE` + `FORCE
  ROW LEVEL SECURITY` y la política estándar, ver §7.7 — y `pnpm verify:rls` falla por
  default si el modelo nuevo no está clasificado), `userId`, `token` (aleatorio ≥32 bytes,
  **hasheado en reposo** — es una credencial), `createdAt`, `lastUsedAt`, `revokedAt`.
- Un botón "Suscribir a mi calendario" que muestra la URL `webcal://` y un QR, más
  "Revocar y regenerar".
- Seguridad, tratado en serio: es una *capability URL*. Viaja en texto plano dentro de la
  URL, queda en logs de acceso y en el historial del cliente. Por lo tanto: token por
  usuario (nunca por tenant), revocable en un clic, rate limit por token, sin datos
  sensibles en el `SUMMARY` (nada de montos de facturas ni notas), y `deletedAt`
  respetado. Registrar el uso en auditoría.
- Correcciones de formato que hay que hacer bien a la primera: `UID` estable por evento
  (si cambia, el cliente duplica en vez de actualizar), `DTSTAMP`/`SEQUENCE` para que las
  ediciones se propaguen, `VTIMEZONE` correcto desde `Tenant.timezone`, y `VALUE=DATE`
  para los `allDay`.

---

### Fase 6 — *(fuera del core)* Plugin Google Workspace / Microsoft

No se planifica en detalle aquí. Se activa bajo los criterios de §3, se construye como
plugin con feature flag y credenciales por tenant según `plugins.md` §1, y **empieza de
una sola vía** (Classia → Google).

---

## 7. Riesgos y decisiones técnicas transversales

### 7.1 Zonas horarias
`Tenant.timezone` existe y hay que usarlo desde el primer commit, no después. Guardar
todo en UTC; renderizar y consultar rangos en la tz del tenant; tratar `allDay` como
fecha local sin instante. Un rango "del 1 al 31 de agosto" calculado en UTC contra un
tenant en UTC-5 pierde o gana eventos en los bordes.

### 7.2 Recurrencia
No en v1 (§4). Cuando llegue: guardar `RRULE` (RFC 5545) y expandir **en el servidor**
con límite duro de ocurrencias, más una tabla de excepciones para "esta semana se
cancela". Materializar filas por ocurrencia es la alternativa tentadora y la que envenena
la base de datos.

### 7.3 La agregación como superficie de fuga de datos
El riesgo de seguridad número uno de este plan. Un endpoint que junta seis módulos es un
punto único donde una consulta mal filtrada expone notas, deudas o datos de otro tenant.
Mitigación: la agregación **llama a los servicios de cada módulo con el actor real**, no
consulta Prisma directamente; y la suite E2E prueba cada fuente con cada rol.

### 7.4 Interacción con asistencia
`isSchoolDayOff` solo aporta si algo lo consume. Definir explícitamente si abrir una
`AttendanceSession` en un día no lectivo se bloquea o solo se advierte — es una decisión
de producto (§9) con impacto en un módulo que ya está en producción.

**Decidido (§9.3) e implementado el 2026-07-26: advierte, no bloquea.**
`AttendanceService#createOrGetSession` devuelve `schoolDayOffWarning` (id, título y mensaje
del evento) cuando la fecha cae en un día marcado, y `/profesor/asistencia` lo muestra arriba
de la lista antes de calificar. Tres detalles que importan:

- El solapamiento se calcula contra los límites del día **en la zona del colegio**, no en UTC:
  un festivo de todo el día vive de 05:00Z a 04:59:59.999Z del día siguiente en Bogotá, y un
  rango en UTC lo pierde en los bordes.
- Es solapamiento y no igualdad de fecha, así que una semana de desarrollo institucional
  advierte en cada uno de sus días.
- Un evento no lectivo **de otro grupo no advierte** sobre este: si advirtiera, la salida
  pedagógica de 6B apagaría la asistencia de 5A. Tiene test propio, y falla al revertirlo.

### 7.5 Volumen
Un colegio genera decenas de eventos por año; nada preocupante. La agregación es lo que
puede pesar: seis consultas por vista de mes. Índices `(tenantId, startsAt)` y
`(tenantId, groupId, startsAt)` desde la migración inicial, y considerar caché corta en
Redis por `(tenant, rango, rol)` solo si la medición lo pide.

### 7.6 Móvil
`apps/mobile` **no existe todavía** (verificado: `apps/` contiene solo `api` y `web`; la app
Expo sigue en el roadmap sin fecha, ver `CLAUDE.md`). Consecuencia: hasta que exista,
el feed ICS de la Fase 5 **es** la estrategia móvil del calendario. Eso refuerza su
prioridad. La lógica de audiencia y agregación debe quedar en el backend, no en el
frontend, para que la app la herede sin reescribir nada.

### 7.7 Row-Level Security — el plan original no lo mencionaba

Agregado el 2026-07-26. La versión inicial de este documento no nombraba RLS en ninguna de
sus 567 líneas, y **la tabla `events` ya tiene `ENABLE` + `FORCE ROW LEVEL SECURITY`** desde
`20260722110000_rls_enable_force_policies`. Tres fases del plan chocan de frente con eso.

Lo primero que hay que interiorizar: **RLS falla cerrado.** El síntoma de equivocarse acá no
es una fuga ni un error, es **cero filas** — un calendario vacío, un feed ICS vacío, un
recordatorio que no se manda. Nada en los logs. Ver el skill `rls-multitenant`.

**El feed ICS de la Fase 5 es el caso más delicado del plan entero.** Se autentica **por
token en la URL**, no con JWT, y lo consume Google Calendar o Apple sin mandar
`x-tenant-slug`. Es decir: corre **sin contexto de tenant**, igual que login/refresh. Sin
hacer nada, `app.tenant_id` queda sin setear y el feed devuelve cero eventos, siempre.

- La salida correcta es **resolver el tenant desde el token** y envolver toda la lectura en
  `tenantRlsContext.runWithTenant(tenantId, ...)`.
- La salida **incorrecta y tentadora** es `PlatformAdminPrismaService` (rol `BYPASSRLS`).
  Un endpoint público por token que además ignora RLS es la peor combinación posible del
  repo: si el token se filtra o se adivina, no queda ninguna barrera debajo. El bypass es
  para lecturas genuinamente cross-tenant de `SUPER_ADMIN` y soporte, y un feed de un
  colegio no lo es.
- La tabla que guarde esos tokens es **tenant-owned**: lleva `tenantId` propio, `ENABLE` +
  `FORCE ROW LEVEL SECURITY` y la política estándar, como los otros 46 modelos. `pnpm
  verify:rls` **falla por default** ante un modelo nuevo sin clasificar, y eso es a
  propósito.

**La agregación de la Fase 3.** §7.3 ya decide lo correcto por razones de permisos —llamar
a los servicios de cada módulo con el actor real en vez de consultar Prisma directo— y de
paso resuelve el contexto de tenant, porque esos servicios corren dentro del request. Dos
cuidados: si se agrega precálculo o calentamiento de caché **fuera** del request, eso
necesita `runWithTenant`; y si la agregación abre transacción, va por
`runInTenantTransaction()`, nunca `prisma.$transaction(...)` crudo (hay una regla de ESLint
que lo bloquea).

**Los recordatorios de la Fase 4.** §1.6 acierta en que BullMQ no requiere infra nueva, pero
falta el requisito que hace que funcione: **el `tenantId` viaja en `job.data`** desde que se
encola, y el processor envuelve su trabajo en `runWithTenant(job.data.tenantId, ...)`, como
ya hacen los 4 processors existentes. Encolar sin `tenantId` no falla: procesa cero filas.

**El cambio de modelo de §5** conserva `tenantId`, así que la política existente sigue
sirviendo y no hay que reescribirla. Igual, correr `pnpm verify:rls` después de la migración
es parte de la Fase 1, no un paso opcional al final.

---

## 8. Orden recomendado y por qué

```
Fase 0 (decisiones)
   └─> Fase 1 (backend)  ──> Fase 2 (UI admin)  ──> Fase 4 (portales + recordatorios)
                          └─> Fase 3 (agregación) ──┘
                                                    └─> Fase 5 (ICS)
```

Si hay que recortar alcance, el orden de valor por esfuerzo es **1 → 2 → 5 → 3 → 4**:
adelantar el feed ICS antes que la agregación pone el calendario del colegio en el
teléfono de las familias antes de terminar el resto, y es la funcionalidad que más se
nota desde afuera. La Fase 3 es la que menos se puede copiar, pero la 5 es la que más
rápido se siente.

---

## 9. Decisiones — **resueltas el 2026-07-26**

Las siete estaban abiertas y bloqueaban la Fase 1. Quedan cerradas con el dueño del
producto; las consecuencias ya están incorporadas en §5 y en las fases.

0. **¿Está aprobado el módulo?** → **Sí, alcance completo** (fases 1-5). Ver §0. Anotado en
   `CLAUDE.md` con fecha.

1. **¿Se confirma el enfoque de §3?** → **Sí.** Interno + agregación + ICS ahora; Google /
   Microsoft queda **fuera del core** como plugin de pago posterior. No hay compromiso
   comercial que obligue a subirlo.

2. **¿Quién puede crear eventos?** → **Un profesor sí puede, acotado a sus propios grupos.**
   Es la decisión con más consecuencias técnicas de la lista:
   - **Corrección del 2026-07-26, al implementarlo:** la primera versión de esta decisión
     decía "permiso nuevo `EVENTS_CREATE_OWN_GROUP`, para que el alcance esté en el permiso
     y no en un `if` disperso". **No funciona:** `PermissionsGuard` exige *todos* los
     permisos del decorador (`requiredPermissions.every(...)`), no cualquiera de ellos, así
     que dos permisos alternativos en la misma ruta se leen como conjunción y el profesor
     recibiría 403. Las salidas eran duplicar la ruta o agregarle semántica "any-of" a un
     guard compartido — más máquina de la que el problema justifica, y sobre una primitiva
     de seguridad. Se hizo lo que ya hace `announcements`: `TEACHER` tiene `EVENTS_CREATE` y
     el alcance lo impone el servicio. Además el alcance real depende de una consulta
     (`Schedule` → grupos), que un decorador no puede hacer de todas formas.
   - `groupId` es **obligatorio** cuando el actor es profesor, y el servicio valida que ese
     grupo esté entre los que enseña. Es exactamente el patrón que
     `announcements.service.ts` ya usa para publicar comunicados por grupo (`create()`, rama
     `TEACHER`), incluida la resolución de grupos vía `Schedule` — se porta, no se inventa.
   - Un profesor edita y borra **solo lo que creó** (de ahí que `createdById` importe para
     algo más que auditoría). El staff administrativo edita y borra todo lo del tenant.
   - `isSchoolDayOff` **no** lo puede marcar un profesor: declarar un día no lectivo es una
     decisión institucional, y además tiene efecto sobre asistencia (§9.3).
   - Ojo con el IDOR intra-tenant: RLS no lo atrapa (mismo tenant), así que la prueba de que
     un profesor no puede crear ni editar para el grupo de otro es un test, no una política.

3. **`isSchoolDayOff` frente a asistencia** → **solo advertir.** Abrir una
   `AttendanceSession` en un día no lectivo sigue permitido, pero la respuesta trae una
   advertencia y la UI la muestra antes de confirmar. Se eligió no bloquear porque asistencia
   ya está en producción y los sábados de recuperación son un caso real, no un error.
   Endurecerlo a bloqueo después es un cambio chico; ablandarlo sería un ticket.

4. **Calendario oficial del MEN** → **precargar solo los festivos nacionales.** Se siembran
   como eventos `FESTIVO` con `isSchoolDayOff`, editables y borrables por el colegio, desde
   una tabla estática (con los traslados de la Ley Emiliani) y sin servicio externo. El
   calendario A/B y las semanas de desarrollo institucional los captura cada colegio: es
   donde de verdad varían y una plantilla equivocada se corrige a mano igual.

5. **Recordatorios** → **configurable por evento.** Consecuencia directa sobre §5: el modelo
   lleva `reminderMinutesBefore Int?` (`null` = sin recordatorio), así que entra en la
   migración de la Fase 1 y no en una segunda. La parte que se rompe en silencio es
   **reagendar**: al editar `startsAt` o la antelación hay que cancelar el job anterior y
   encolar el nuevo, con `jobId` derivado del `id` del evento vía `core/queue/job-id.ts`
   (ver el antecedente de `41d86f5` en la Fase 4).

6. **Alcance del feed ICS** → **eventos institucionales + las entregas del alumno** (título y
   materia, nada más). Los vencimientos de facturas quedan **fuera** en cualquier caso: un
   monto de deuda en una URL sin sesión no es aceptable. El `SUMMARY` no lleva notas, montos
   ni observaciones; el detalle exige entrar a la app.
