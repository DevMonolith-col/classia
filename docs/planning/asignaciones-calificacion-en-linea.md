# Plan: Calificar Asignaciones en Línea

> Plan técnico para "calificar asignaciones ahí mismo": que el profesor pueda ver la
> entrega y ponerle nota sin dar vueltas. Auditoría hecha sobre el código real de
> `develop` el 2026-07-16 — cada afirmación se verificó leyendo el archivo.
> **No se ha implementado nada de lo aquí descrito todavía.**
>
> Este plan tiene una **frontera estricta** con el trabajo paralelo de "notas y reportes",
> que lo lleva otra persona con su propio agente. Ver §2 — es la sección más importante
> del documento y hay que leerla antes de tocar código.

## 1. Punto de partida: la feature ya existe

**Esto no es construir desde cero. Es desenterrar y arreglar.** El backend está completo
y la UI existe, escondida.

| Pieza | Dónde | Estado |
|---|---|---|
| Endpoint de calificar | `PATCH /homework/:homeworkId/submissions/:submissionId/grade` — `homework-submissions.controller.ts:46-56` | ✅ Completo |
| Lógica de calificar | `homework-submissions.service.ts:88-163` | ✅ En transacción, con auditoría |
| UI de calificar | `SubmissionsSection` — `apps/web/components/profesor/homework-editor.tsx:355-533` | ⚠️ Funciona, pero enterrada y con un bug |
| Subir/ver archivos | Módulo `files` (S3/MinIO, URLs firmadas, allowlist MIME, 15 MB) | ✅ Completo |
| Permisos | `HOMEWORK_SUBMISSIONS_GRADE` — `permissions.ts:59-62` | ✅ TEACHER + los 4 roles de admin |

`grade()` hace, en una sola transacción (`:107-147`): marca la entrega `GRADED`, escribe
`feedbackComment`/`feedbackKey`/`feedbackName`/`gradedAt`, y crea o actualiza la `Mark`
correspondiente heredando `tenantId`/`subjectId`/`teacherId` del homework. Después audita
`homework_submission.graded` con old/new values.

### El flujo que un profesor debe seguir HOY

Contado paso a paso, porque el problema se entiende mejor así:

1. `/profesor/asignaciones` → elegir la clase en el `Select`
2. Filtrar por tipo y paginar hasta encontrar la tarea (5 por página)
3. Clic en **"Editar"** — no existe ningún botón que diga "Calificar"
4. Bajar hasta el fondo del formulario de edición, pasando peso, fechas, adjuntos y modo
   de navegación
5. En "Entregas", clic "Ver archivo" → **diálogo a pantalla completa**
   (`attachment-preview-dialog.tsx:69` → `inset-0 h-screen w-screen`)
6. **Cerrar el diálogo** — no se puede ver el PDF y el campo de nota a la vez
7. Clic "Calificar" → **la lista de entregas desaparece**, reemplazada por el formulario
   (`homework-editor.tsx:445`, render condicional `grading ? ... : ...`)
8. Escribir la nota — **el campo dice 100, no la nota real** (ver §3)
9. Para el siguiente alumno: volver al paso 5

**Los tres problemas de fondo**: la calificación vive dentro del editor de configuración
(no tiene puerta propia), no se puede mirar el trabajo y calificarlo simultáneamente, y
cada alumno obliga a rehacer el recorrido.

### Lo que además falta

- **La nota no se ve en la lista.** Ninguna columna la muestra (`:481-520`). El profesor
  no sabe a quién ya calificó salvo por el badge `GRADED`.
- **Los que no entregaron no existen.** `listForHomework` (`:78-86`) devuelve solo filas de
  `HomeworkSubmission`, que solo nacen cuando el alumno entrega (`upsert`, `:35`). No se
  puede poner 0 a quien no entregó.
- **`feedbackKey`/`feedbackName` no tienen UI.** El backend acepta **devolver un archivo
  corregido** al alumno (`schemas:15-16`, `service:113-114`); el formulario solo manda
  `feedbackComment` (`:406-410`). `FileUploadField` ya existe.
- **Sin paginación ni filtros** en la lista de entregas: un curso de 35 alumnos son 35
  filas planas.
- **Solo aparece para TAREA y PROYECTO** — `QUIZ_LIKE_TYPES = new Set(["QUIZ","EXAMEN"])`
  (`:38`), condicional en `:348`. Correcto: quices y exámenes se autocalifican y tienen su
  propia pantalla (`/profesor/quiz/[homeworkId]/calificar`).
- **Cero tests.** No existe **ni un solo** test de `POST /homework/:id/submissions`,
  `GET .../submissions`, ni de `PATCH .../grade`. El único archivo de test del repo
  (`backend-v1.e2e-spec.ts`, 1167 líneas) no cubre nada del circuito de calificación.

## 2. Frontera con "notas y reportes" ← LEER ANTES DE TOCAR CÓDIGO

Calificar una entrega **escribe en `Mark`**. "Notas y reportes" **es dueño de `Mark`**.
Sin una frontera explícita, los dos agentes editan `marks.service.ts` y el schema a la vez
y el merge es un desastre.

### Regla

> **Este plan solo toca `apps/api/src/modules/homework-submissions/*` y su UI.**
> **Leer `Mark` sí. Escribir el modelo o el servicio de `Mark`, no.**

| Archivo / área | Dueño |
|---|---|
| `modules/homework-submissions/*` | **Este plan** |
| `components/profesor/homework-editor.tsx` + la UI nueva de entregas | **Este plan** |
| `app/profesor/asignaciones/[homeworkId]/*` | **Este plan** |
| `modules/marks/*` | Notas y reportes |
| `model Mark` en `schema.prisma` | Notas y reportes |
| `app/profesor/calificaciones/*` (la grilla) | Notas y reportes |
| `components/shared/student-grades-table.tsx` | Notas y reportes |
| `permissions.ts` | Compartido — coordinar cualquier edición |

`homework-submissions.service.ts` **ya escribe `Mark` directo con Prisma** (`:126-143`) y
eso **no cambia en este plan**. Si "notas y reportes" decide convertir `MarksService` en el
único writer, este servicio se adapta a llamarlo — ver el contrato de abajo.

### Contrato de handoff → para el agente de "notas y reportes"

Estos 5 puntos están **verificados en el código** y **fuera del alcance de este plan**.
Son deuda real que vive en territorio de notas:

1. **`Mark` no tiene `@@unique([studentId, homeworkId])`** (`schema.prisma:288-309`, no
   tiene **ningún** índice). Hay **3 writers independientes** haciendo `findFirst` →
   `update`/`create` sin protección: `homework-submissions.service.ts:120-143`,
   `quiz-attempts.service.ts:348-371` (además **fuera de transacción**) y
   `marks.service.ts:132,181,255` (donde `POST /marks` ni siquiera comprueba existencia
   previa). Es race-prone y permite notas duplicadas para la misma tarea+alumno.

2. **Decisión pendiente: ¿es `MarksService` el único writer de `Mark`?** Si sí, resuelve
   los puntos 3 y 4 de un golpe, y este plan adapta `grade()` para llamarlo. Si no, ambos
   caminos deben mantener el invariante a mano. **Esta decisión es de notas, no de este
   plan** — avisar cuál se toma.

3. **Divergencia de estado entre los dos caminos de calificación.** Son dos rutas para el
   mismo acto que producen estados distintos:

   | | `/profesor/calificaciones` (celda) | `/profesor/asignaciones/:id` (Entregas) |
   |---|---|---|
   | Escribe `Mark.value` | ✅ | ✅ |
   | `Submission.status = GRADED` | ❌ | ✅ |
   | `Submission.gradedAt` / `feedbackComment` | ❌ | ✅ |
   | Emite `MARK_PUBLISHED` | ✅ (vía `MarksService`) | ❌ (Prisma directo) |
   | Rango | 0-100 hardcodeado (`page.tsx:153`) | `maxValue` configurable 1-1000 |

   **Consecuencia verificable**: si el profesor califica desde la grilla de notas, la
   entrega **se queda en "Entregado" para siempre** y el alumno **nunca ve la
   retroalimentación** — la condición de render es
   `submission.status === "GRADED" && submission.feedbackComment`
   (`app/alumno/tarea/[homeworkId]/page.tsx:180`). Y al revés: calificar desde Entregas
   **no notifica al alumno**.

4. **Calificar no emite `MARK_PUBLISHED`.** Ni `homework-submissions.grade()` ni
   `quiz-attempts.finalizeAttemptIfComplete()` pasan por `MarksService`, así que
   `emitMarkPublished` (`marks.service.ts:38-49`) nunca corre. El alumno y el acudiente no
   se enteran de su nota salvo que entren a mirar.

5. **Dos bugs en la grilla de `/profesor/calificaciones`**, ambos en territorio de notas:
   - **El filtro de periodo esconde justo lo que hay que calificar**: `filteredHomeworkList`
     (`:129-136`) devuelve `false` para cualquier homework **sin ninguna Mark** → al elegir
     un periodo, las tareas sin calificar desaparecen.
   - **La nota final ignora el filtro**: `computeFinalGrade` itera `homeworkList` sin
     filtrar (`:235`), no `filteredHomeworkList`.
   - Bonus: `computeFinalGrade` está **duplicado y divergente** entre
     `app/profesor/calificaciones/page.tsx:232-243` y
     `components/shared/student-grades-table.tsx:33-43` — el segundo asume `weight = 10`
     cuando la Mark no tiene homework (`:40-41`); el primero no. Las dos fórmulas **no
     coinciden**.

## 3. Los dos bugs de este plan

### Bug 1 — "Editar nota" te sobrescribe la nota con 100

```ts
// apps/web/components/profesor/homework-editor.tsx:386-391
function openGradeDialog(submission: HomeworkSubmission) {
  setGrading(submission)
  setValue("100")        // ← SIEMPRE 100
  setMaxValue("100")     // ← SIEMPRE 100
  setFeedbackComment(submission.feedbackComment ?? "")
}
```

El botón dice **"Editar nota"** cuando el estado es `GRADED` (`:515`), abre el formulario
con **100** y guardar sin fijarse **pisa la nota real con 100**.

**La causa raíz está en el backend**: `submissionSelect()`
(`homework-submissions.service.ts:234-251`) **no incluye la `Mark`**. El frontend no tiene
el dato ni aunque quisiera — no es que se le olvide precargarlo, es que nunca lo recibió.

**Arreglo** (dentro de la frontera: es un `select`, lectura de `Mark`, en un archivo
propio):

```ts
// homework-submissions.service.ts — submissionSelect()
student: { select: { id: true, firstName: true, lastName: true } },
// NUEVO: la nota vigente, para poder precargarla y mostrarla en la lista.
// Lectura de Mark. Este servicio NO deja de escribir Mark directo en esta fase
// (ver §2, punto 2 del contrato).
```

Como `Mark` no tiene relación inversa navegable desde `HomeworkSubmission` (el vínculo es
indirecto: `Mark.homeworkId + Mark.studentId`), hay que resolverlo con una consulta
adicional en `listForHomework`/`grade` y mapearlo — **no** agregando una relación al
modelo `Mark`, que es territorio ajeno.

### Bug 2 — El estado divergente

Es el punto 3 del contrato de §2. **Es de notas, no de este plan.** Se documenta aquí
porque la UI nueva lo va a hacer visible: cuando el workbench muestre la nota en la lista,
un alumno calificado desde la grilla aparecerá con nota pero con badge "Entregado", y va a
parecer un bug de este plan. No lo es.

## 4. El workbench de calificación

**Ruta propia**: `/profesor/asignaciones/[homeworkId]/entregas`. Hoy `[homeworkId]/page.tsx`
(54 líneas) solo renderiza el editor; la calificación pasa a tener su propia puerta, con
un botón **"Calificar (N)"** en `AssignmentCard` cuando hay entregas sin calificar.

**Layout de 3 paneles en escritorio:**

```
┌──────────────┬───────────────────────────┬──────────────────┐
│ Alumnos      │  Documento entregado      │  Calificación    │
│ (navegación) │  (PdfViewer inline)       │                  │
│              │                           │  Nota  [ 85 ]    │
│ ● Ana P.  85 │  ┌─────────────────────┐  │  Máx   [100 ]    │
│ ○ Bruno  --  │  │                     │  │                  │
│ ● Carla  92  │  │   tarea-ana.pdf     │  │  Comentario      │
│ ⚠ Diego  --  │  │                     │  │  [            ]  │
│   (no entregó)│  └─────────────────────┘  │                  │
│              │                           │  Devolver archivo│
│ [Tabs estado]│                           │  [ Subir ]       │
│              │                           │                  │
│              │                           │ [Guardar y →]    │
└──────────────┴───────────────────────────┴──────────────────┘
```

Lo que resuelve, punto por punto contra el flujo de §1:

- **Ver y calificar a la vez** (pasos 5-6): el documento se renderiza inline con
  `PdfViewer` — que ya existe y ya es `dynamic`/`ssr:false` (`attachment-preview-dialog.tsx:11-18`)
  — en vez de en el diálogo `h-screen w-screen`. `AttachmentPreviewDialog` **no se toca**:
  se sigue usando en el resto de la app; el workbench usa `PdfViewer` directo.
- **"Guardar y siguiente"** (paso 9): guarda y avanza al siguiente sin calificar, sin
  volver a la lista. Es el único atajo que importa.
- **La nota se ve en la lista** (columna derecha del panel de alumnos), que es lo que hoy
  no existe.
- **Los que no entregaron aparecen** con badge propio y se les puede poner 0.
- **El formulario no reemplaza la lista** (paso 7): son paneles distintos.

En móvil colapsa a un panel a la vez (lista → documento → nota), navegable — no se
intenta meter 3 columnas en 375px.

### Sobre el estándar de listados (`f11026a`)

El estándar vigente manda `PAGE_SIZE = 5`, filtro por `Tabs`, footer de paginación y card
único; está replicado byte a byte en las 3 vistas de asignaciones y **cualquier listado
nuevo debe respetarlo**.

**Aquí se cumple a medias, deliberadamente**: el filtro por estado usa `Tabs` como manda el
estándar, pero **el panel de alumnos no pagina a 5**. Razón: no es un listado de *browse*,
es un panel de *navegación* dentro de una herramienta de trabajo — paginar de 5 en 5 a un
curso de 35 alumnos reintroduce exactamente la fricción que esta feature existe para
eliminar. Es scroll vertical con la lista completa. **Esto es una desviación consciente
del estándar, no un descuido.**

## 5. Cambios de backend

Todo dentro de `modules/homework-submissions/*`.

### `GET /homework/:homeworkId/submissions` → roster completo

Hoy devuelve solo filas de `HomeworkSubmission` (`:81-85`). Pasa a devolver **el roster del
grupo**, con la entrega si existe:

```ts
// { student, submission: {...} | null, mark: { value, maxValue } | null }[]
// El roster sale de Student where groupId = homework.groupId (lectura, dentro de frontera).
```

Esto habilita "los que no entregaron aparecen" y "la nota se ve en la lista" de una sola
vez, y de paso mata el **N+1 del dashboard** (`app/profesor/page.tsx:86-100`, que hoy hace
`GET /homework` y luego un `GET .../submissions` por cada tarea con entregas).

### Nuevo: `PATCH /homework/:homeworkId/submissions/by-student/:studentId/grade`

El endpoint actual califica por `submissionId`, que **no existe** si el alumno no entregó.
Este hermano hace `upsert` por `studentId`: crea la entrega con `submittedAt: null` y
`status: "GRADED"`. Mismo permiso `HOMEWORK_SUBMISSIONS_GRADE`, misma transacción, misma
auditoría. El endpoint por `submissionId` se mantiene (lo usa la UI actual).

Así "no entregó pero tiene 0" queda representable: `submittedAt === null && status === "GRADED"`.

### Vocabulario de estado

`status` es un `String` libre, no un enum (`schema.prisma:412`). Los valores reales que
escribe el código son `SUBMITTED` / `LATE` / `GRADED` (`service:33,111`).

**`PENDING` (el default del schema, `:412`) es inalcanzable**: ningún camino crea una
submission sin `status` explícito — el único `create` es el `upsert` de `:35-44`. La UI
tiene label y color para él y **nunca se renderiza**. Es código muerto: quitarlo del
vocabulario del front. El estado "no entregó" se deriva de `submission === null` en el
roster, que es más honesto que fabricar filas fantasma.

### Permiso de GUARDIAN

`GUARDIAN` no tiene **ningún** `HOMEWORK_SUBMISSIONS_*` (`permissions.ts:477-492`) → un
acudiente no puede ver la entrega ni la retroalimentación de su hijo. Agregar
`HOMEWORK_SUBMISSIONS_READ` con scope de hijo propio desbloquea `familia/tareas` (hoy 100%
mock, `mockTasks` en `app/familia/tareas/page.tsx:38-112`).

> `permissions.ts` es **archivo compartido** (§2) → coordinar este cambio antes de hacerlo.
> Conectar `familia/tareas` **no está en este plan**; esto solo le quita el bloqueo.

## 6. Plan por fases

Cada fase se cierra con typecheck limpio (api + web), e2e verdes y verificación en
navegador como profesor.

**Fase 1 — Parar el sangrado (independiente, mergeable sola)**
1. `submissionSelect()` incluye la nota vigente; `openGradeDialog` la precarga en vez de
   poner `100`. **Arregla la pérdida de datos del Bug 1 sin ninguna UI nueva.**
2. Mostrar la nota en la lista de entregas actual.
3. Primeros e2e: `grade()` crea la Mark, la actualiza si existe, y respeta el scoping de
   profesor ajeno (hoy: cero cobertura).

**Fase 2 — Roster completo**
4. `GET .../submissions` devuelve el roster con `submission | null` + `mark | null`.
5. `PATCH .../by-student/:studentId/grade` con upsert.
6. Quitar `PENDING` del vocabulario del front; derivar "no entregó" de `submission === null`.
7. e2e: calificar a un no-entregador crea la submission con `submittedAt: null`.

**Fase 3 — El workbench** (el corazón: aquí deja de doler)
8. Ruta `/profesor/asignaciones/[homeworkId]/entregas` con el layout de 3 paneles.
9. `PdfViewer` inline + "Guardar y siguiente".
10. Botón "Calificar (N)" en `AssignmentCard` → la puerta propia.
11. Responsive: colapso a un panel en móvil.

**Fase 4 — Devolver el trabajo corregido**
12. Cablear `FileUploadField` a `feedbackKey`/`feedbackName` (backend **ya listo**,
    `service:113-114`).
13. Mostrar el archivo devuelto en `app/alumno/tarea/[homeworkId]/page.tsx`.

**Fase 5 — Desbloquear a la familia** (coordinar `permissions.ts` antes)
14. `HOMEWORK_SUBMISSIONS_READ` para GUARDIAN con scope de hijo propio, siguiendo el patrón
    `resolveOwnChildIds` que ya existe en homework/marks/attendance desde `4e3517c`.
15. e2e de scoping: un acudiente no ve la entrega de un compañero de curso.

**Fuera de alcance, con dueño** — los 5 puntos del contrato de §2 (notas y reportes).

## 7. Restricciones que este plan respeta

- **`/admin/asignaciones` sigue siendo solo lectura.** Es una decisión consciente
  ("el profesor gestiona, el admin audita", `estado-del-proyecto.md:103`). Ojo con la
  tentación: `permissions.ts:208-209,282-283,349-350,416-417` **ya da**
  `HOMEWORK_SUBMISSIONS_GRADE` a TENANT_ADMIN/PRINCIPAL/COORDINATOR/SECRETARY — hay permiso
  de backend sin UI. Si un admin va a calificar, es una **decisión de producto nueva y
  explícita**, no un efecto secundario de este plan.
- **No se unifica la grilla editable de profesor con las tablas read-only.**
  `frontend-unificacion-roles.md:90-95` lo declara explícitamente fuera de su matriz:
  *"son concerns genuinamente distintos, forzar su unificación violaría el principio de
  bajo acoplamiento"*.
- **Gating por permiso, no por rol.** `frontend-unificacion-roles.md:97-105`: ningún
  componente compartido debe preguntar `role === "TEACHER"`, sino
  `usePermissions().can(HOMEWORK_SUBMISSIONS_GRADE)`. El array `membership.permissions`
  **ya viene en `/app/bootstrap`** y cero archivos de `apps/web` lo leen. Si `lib/bootstrap.ts`
  (Fase 0 de ese plan) aún no existe cuando esto se implemente, el workbench es un buen
  primer consumidor.
- **La UI ocultando un botón nunca reemplaza el guard del endpoint**
  (`frontend-unificacion-roles.md:193-203`). Los endpoints nuevos llevan su
  `@Permissions(...)` igual que los demás.
- **El estándar de listados `f11026a`** se cumple en el filtro (Tabs) y se desvía
  conscientemente en la paginación (§4).

## 8. Nota sobre `estado-del-proyecto.md`

Ese documento se auto-declara "fuente de verdad" pero **está desactualizado**: fue escrito
el 2026-07-13 y el commit `5e93a6a` del mismo día lo dejó obsoleto en horas. Afirmaba que
`HomeworkSubmission` era un modelo fantasma sin código encima (`:98`), que no existía la
calificación manual de respuesta corta (`:102`) y que `GUARDIAN` no tenía scoping (`:104-105`)
— **las tres son falsas hoy**. Se corrigió junto con este plan; si algo de aquí contradice
a ese doc, gana este.
