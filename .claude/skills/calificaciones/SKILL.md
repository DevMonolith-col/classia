---
name: calificaciones
description: Cómo se escriben y leen las notas en Classia — el writer único upsertMark() y su variante transaccional, cuál usar según haya o no un `tx` abierto, por qué el aviso al alumno va después del commit, la trampa de academicYearId que hace invisible una nota, y la asimetría deliberada de notificación del quiz. Úsalo al tocar Mark, calificación de entregas, autocalificación de quices, la tabla de calificaciones del profesor, o boletines/report-cards.
---

# Calificaciones (`Mark`)

Es la zona más intrincada del repo. Hasta el 2026-07-26 había cuatro caminos escribiendo `Mark`
por su cuenta, cada uno con efectos secundarios distintos; hoy casi todos enrutan por el writer
único — pero en **dos variantes**, y elegir la equivocada rompe el aislamiento por tenant en
silencio. Empieza por saber cuál te toca.

## El writer único

`MarksService.upsertMark(input, actor, options?)` (`apps/api/src/modules/marks/marks.service.ts`)
es la fuente única de verdad. Hace tres cosas que un `mark.create` suelto no hace:

1. **Ancla la nota a un año académico**: el que manda el llamante, o el activo del tenant como
   fallback, y **lanza** si no hay ninguno. Esto no es decorativo — ver la trampa de abajo.
2. **Registra auditoría** sobre la entidad `Mark`, con `oldValues`/`newValues`.
3. **Emite `MARK_PUBLISHED`** solo en la transición real (la nota queda publicada y antes no lo
   estaba), para que el alumno se entere una vez y no en cada reescritura.

Es idempotente por `(studentId, homeworkId)`. El schema tiene `@@unique([studentId, homeworkId])`
(`schema.prisma:403`), y Postgres trata `NULL` como distinto, así que las notas manuales sueltas
(`homeworkId = null`) siguen creándose siempre — solo las ligadas a una tarea se sobrescriben en
vez de duplicarse.

**Si escribes una nota desde un módulo nuevo, enruta por acá.** No repliques el `findFirst` →
`update`/`create`.

## Estado real: los tres caminos de calificación ya enrutan por el writer único

Desde el **2026-07-26** los dos writers que escribían `Mark` por su cuenta pasan por
`upsertMark()`. Quedan dos variantes del writer según si hay o no una transacción abierta, y
esa distinción **no es opcional**:

| Camino | Dónde | Cómo escribe |
|---|---|---|
| `MarksService.upsertMark` | `marks.service.ts` | writer único, fuera de transacción |
| `MarksService.upsertMarkInTransaction` | `marks.service.ts` | writer único, recibe el `tx` |
| `MarksService.bulkCreate` | `marks.service.ts:320` | `upsert` inline (`:381`) — **el único que sigue aparte** |
| Calificar una entrega | `homework-submissions.service.ts` | `upsertMarkInTransaction(..., tx)` |
| Calificar por estudiante | `homework-submissions.service.ts` | mismo camino: `applyGrade()` |
| Autocalificar un quiz | `quiz-attempts.service.ts` | `upsertMark(..., { notifyStudent })` |

**Cuál de las dos usar.** Si ya estás dentro de `runInTenantTransaction`, tiene que ser
`upsertMarkInTransaction(input, actor, tx)`. `upsertMark()` escribe por `this.prisma` y ahí
adentro tomaría otra conexión del pool, sin `app.tenant_id`. Ver el skill `rls-multitenant`,
trampa #3.

**El `publish()` va después del commit.** `upsertMarkInTransaction` devuelve `{ mark, publish }`
y *no* emite `MARK_PUBLISHED`: emitirlo dentro de la transacción le avisaría al alumno de una
nota que un rollback deshace. El llamante invoca `publish()` cuando la transacción ya comiteó.

**La auditoría viaja por el mismo cliente.** `AuditService.record(input, client)` acepta el `tx`,
y hay que pasárselo: `audit_logs` tiene FORCE ROW LEVEL SECURITY, así que un insert por
`this.prisma` con una transacción abierta lo rechaza la política. De paso queda atómico con lo
auditado.

**`notifyStudent`.** `upsertMark` y `upsertMarkInTransaction` aceptan `{ notifyStudent }`
(default `true`). Existe por un caso concreto: cuando el alumno acaba de enviar un quiz
autocalificable, ya está viendo su nota en la respuesta y la notificación sería ruido. Ver la
asimetría del quiz más abajo.

El constraint único impide que se **dupliquen** notas, pero en una carrera fallan con violación
de unicidad (P2002) y nadie la maneja.

## La trampa que hace invisible una nota

`Mark.academicYearId` es **nullable**. La columna se agregó el 2026-07-16
(`20260716230000_scope_marks_homework_to_academic_year`) sin backfill ni default, y los dos
writers de arriba no la seteaban: **eso fue un bug real, arreglado el 2026-07-25** (los dos
writers + la migración de backfill `20260725120000_backfill_mark_academic_year`). Sigue siendo
lo primero que hay que mirar ante "califiqué y no aparece", y lo primero que hay que setear en
un writer nuevo, porque la columna sigue aceptando `NULL`.

Una nota con `academicYearId = null` desaparece de todas las lecturas, porque todas filtran por
año:

- `MarksService.list()` resuelve el año activo cuando el query no lo trae y filtra por él
  (`marks.service.ts:161-176`) → invisible en `/alumno/calificaciones` y `/familia/calificaciones`
- `/profesor/calificaciones` y `/admin/calificaciones` mandan `academicYearId` explícito
- **`report-cards.service.ts:148`** filtra `{ studentId, academicYearId: year.id, isPublished: true }`
  → **la nota no cuenta para el boletín**

Consecuencia concreta cuando falta: la nota que el alumno nunca ve y que no suma al boletín, con
un 200 en el endpoint y sin ningún error en los logs.

**Si vuelve a pasar en otro writer, no lo arregles de un solo lado.** Setear `academicYearId`
corrige lo nuevo pero deja huérfanas las notas ya escritas; hace falta backfill. El del
2026-07-25 ancló cada nota huérfana al año del `Homework` cuando lo había, y al año activo del
tenant si no, y es idempotente.

El writer setea `academicYearId` también en la rama de `update`, así que recalificar sana una
nota que quedó huérfana antes del arreglo.

**El año de la tarea manda cuando se conoce.** Quien califica una tarea pasa
`academicYearId: homework.academicYearId`; el año activo del tenant es solo el fallback. Una
tarea de un año ya cerrado que se califica tarde pertenece a *su* año — anclarla al activo la
mandaría al boletín del año equivocado. `Mark.date` tiene default `now()`, así que guiarse por
la fecha tiene el mismo defecto.

## Lo que todavía divergen las dos pantallas

Desde el 2026-07-26 ambos caminos auditan sobre `Mark` y notifican al alumno. Queda **una**
diferencia real:

- Desde **`/profesor/calificaciones`** (`POST/PATCH /marks`) **no se marca la entrega como
  `GRADED`** → el alumno no ve la retroalimentación asociada.
- Desde **Entregas** (`homework-submissions`) sí, además de escribir la nota.

## La asimetría deliberada del quiz

`finalizeAttemptIfComplete` tiene dos call sites que son situaciones opuestas, y solo uno
notifica:

- **`submit()`** — lo dispara el alumno. Si el quiz es todo autocalificable, la nota nace ahí
  mismo mientras él ve su puntaje en la respuesta → `notifyStudent: false`.
- **`gradeAnswer()`** — lo dispara el profesor al calificar la última respuesta abierta. El
  alumno no está presente → `notifyStudent: true`.

Si estás por "arreglar" esa inconsistencia, es intencional. Está cubierta por un test que falla
si se unifica en cualquiera de las dos direcciones.

El actor auditado en el camino del alumno es **el alumno**, no el profesor: la nota existe
porque él envió el quiz, y la bitácora dice eso.

## La pérdida de datos de la UI, y cómo llega la nota a la entrega

**Arreglado el 2026-07-26.** `openGradeDialog` precargaba siempre `setValue("100")` y
`setMaxValue("100")`, incluso cuando el botón dice "Editar nota" (la entrega ya está `GRADED`).
Entrar a cambiar solo el comentario pisaba la calificación con 100/100 — y sobre una tarea
calificada sobre 5, además rompía la validación "no superar el máximo" de la edición siguiente.

La causa estaba en el backend: `submissionSelect()` no tiene la `Mark`, así que la UI no tenía
de dónde sacarla. **`HomeworkSubmission` no tiene relación con `Mark`**: se ligan por
`(studentId, homeworkId)`, que es el `@@unique` de `Mark`. Por eso `listForHomework` la adjunta
con `withCurrentMarks()`, una consulta aparte unida en memoria — una por llamada, no una por
entrega. Agregar la relación al schema significaría cambiar la forma de `Mark`, que tiene
frontera estricta con notas/boletines (`asignaciones-calificacion-en-linea.md` §2).

Desde ese mismo día `listForHomework` devuelve el **roster**: una fila por estudiante del curso,
con `submission: null` para quien no entregó. No existe un estado que represente eso —
`PENDING` es el default del schema y ningún camino lo escribe, así que se sacó del vocabulario
del front y del fixture de e2e, que lo fabricaba y hacía que el test ejercitara una transición
irreal.

Para calificar a quien no entregó está `gradeByStudent()`, que hace `upsert` de la entrega con
`submittedAt: null` y `status: "GRADED"` — ese par **es** la representación de "no entregó pero
tiene nota". Comparte cuerpo con `grade()` a través de `applyGrade()`, así que la escritura de
la `Mark` sigue pasando por el writer único, en la misma transacción y con el `publish()`
después del commit. Valida que el estudiante sea del grupo de la tarea: sin eso el profesor
puede escribirle una nota a un alumno que no cursa la materia.

Si agregas otro consumidor que necesite la nota, pásalo por ese helper en vez de volver a
resolver el join. `findForOwnStudent` (portal de familia) **deliberadamente no la lleva**: la
nota del hijo vive en `/familia/calificaciones`, que lee `/marks`, y duplicarla en dos
pantallas invita a que se desincronicen.

Cuando no hay nota previa el campo va **vacío**, no en 100: un 100 servido de entrada es la
misma pérdida de datos en la primera calificación. Eso obligó a arreglar también la validación
de `handleGradeSubmit`, que usaba `Number.isNaN(Number(value))` — y `Number("")` es `0`, no
`NaN`, así que un campo vacío se colaba como un cero válido.

## Semántica de valores

`value` y `maxValue` son `Float` (`maxValue` default 100). `MarksService.update()` valida
`value <= maxValue`; `upsertMark()` **no** — quien llame es responsable. `bulkCreate` sí valida
contra el `maxValue` del lote.

La autocalificación de quices normaliza a base 100: `Math.round((totalScore / maxScore) * 100 * 100) / 100`
(`quiz-attempts.service.ts:355`), así que el `maxScore` real del quiz no queda en la `Mark`.

`isPublished` default `true`. `report-cards` solo lee notas publicadas.

## Cobertura de tests

Dos tests en `apps/api/test/backend-v1.e2e-spec.ts`:

- **"anchors the mark to the active academic year when grading a submission"** — `PATCH
  /homework/:id/submissions/:id/grade`: la nota nace con `academicYearId`, recalificar sana una
  huérfana, la nota queda alcanzable por el filtro del boletín, hay auditoría sobre `Mark` y
  llega la notificación (al acudiente, porque ese alumno no tiene `User`).
- **"grades a quiz through the single writer, notifying only when the teacher closes it"** —
  los dos disparadores del quiz: el profesor cerrando la calificación (notifica) y el alumno
  enviando un quiz autocalificable (no notifica), ambos con año y auditoría.

Dos detalles de los que depende que sirvan de algo, y que es fácil borrar sin darse cuenta:

- El primero **borra la nota ligada a la tarea antes de calificar**, para forzar el camino de
  `create`. Sin eso entra por `update`, que también setea el año, y no prueba nada.
- El segundo **espera de verdad antes de afirmar que no hay notificación**. El listener es
  asíncrono; aseverar la ausencia sin darle tiempo pasaría igual con el comportamiento contrario.

Dos más desde el 2026-07-26, en el mismo archivo:

- **"returns each submission with its current mark, so the grade dialog can preload it"** — el
  dato que le faltaba a la UI para no pisar la nota con 100. Afirma `value` **y** `maxValue`:
  precargar 100 sobre una tarea sobre 5 rompe la validación de la edición siguiente.
- **"stops a teacher from grading a colleague's assignment"** — la validación de
  `getHomeworkForTeacherCheck` existía desde siempre y **nunca había tenido un test que la
  ejerciera**. Verificado revirtiendo la comparación de `teacherId` a un simple "tiene ficha de
  profesor": el ajeno califica con 200 y el test cae.

Y tres de la Fase 2 (roster completo, calificar a un no-entregador con `submittedAt: null`, y
403 al calificar a un alumno de otro grupo). El primero **limpia la entrega del compañero antes
de afirmar que no existe**: el test que le sigue se la crea, y sin esa limpieza la segunda
corrida fallaba por un dato de la anterior. Si agregas tests sobre estos fixtures, corre la
suite **dos veces seguidas** — la primera pasa igual.

Sigue **sin haber** test de `POST /homework/:id/submissions`, de `POST /marks` / `upsertMark()`
directo, ni de `bulkCreate`.

El fixture `ensureGuardianScopingFixtures` ya deja profesor, acudiente, alumno sin `User`, alumno
**con** `User` (`QUIZ_STUDENT_EMAIL`, necesario para enviar un quiz), tarea anclada al año activo,
una entrega en `PENDING`, dos quices (uno con pregunta abierta y uno todo autocalificable) y un
año académico activo garantizado. Resetea intentos y notas en cada corrida, porque la BD de dev
es compartida. Reúsalo en vez de armar otro; y ojo con el rate-limit de `/auth/login` (20/min por
IP) si agregas logins — la suite ya está en el límite.

## Profundizar

- `docs/planning/asignaciones-calificacion-en-linea.md` §2 — el contrato de `Mark` y la frontera
  estricta con el dominio de notas/boletines. **Leerlo antes de cambiar la forma de `Mark`**: hay
  trabajo paralelo de otro equipo que depende de ese contrato.
- `docs/planning/notas-reportes-motor.md` y `notas-reportes-handoff.md` — el motor de boletines.
- Toda escritura de `Mark` va en `runInTenantTransaction`; ver el skill `rls-multitenant`.
