# Notas y Reportes: motor de calificaciones, escalas y boletines

> Diseño técnico del dominio de Notas. Implementado en la rama
> `feature/notas-reportes-refactor`. Cada afirmación corresponde a código real.
> Frontera con Entregas y Mensajería: ver `asignaciones-calificacion-en-linea.md §2`.

## 1. Qué resuelve

El apartado de calificaciones era demasiado básico: solo un `period Int` suelto en
`Mark`, la definitiva se calculaba en el frontend (duplicada y divergente), no había
escalas ni categorías ponderadas, y nada impedía notas duplicadas. Este trabajo
agrega:

- **Configuración académica por colegio**: año lectivo, periodos configurables con
  bloqueo, escalas genéricas y categorías ponderadas.
- **Motor de definitivas en el backend**: una sola fórmula, categoría → periodo → año.
- **Boletines inmutables**: snapshots congelados que no mutan al recalcular históricos.
- **Integridad de `Mark`**: índice único y un writer idempotente centralizado.

## 2. Modelo de datos

Todo lleva `tenantId` (multi-tenant estricto). Modelos nuevos:

| Modelo | Rol |
|---|---|
| `AcademicYear` | Año lectivo. `OPEN`/`ARCHIVED`, uno `isActive` por tenant. |
| `AcademicPeriod` | Periodo con `weight` (% del año) y `lockedAt` (cierre de notas). N configurable. |
| `GradingScale` + `GradingScaleBand` | Escala **genérica** (rango + nota aprobatoria) y sus bandas cualitativas. |
| `GradingCategory` | Categoría ponderada **por clase** (`groupId + subjectId + teacherId + periodId`). |
| `ReportCard` + `ReportCardLine` | Boletín inmutable: snapshot de definitivas por materia. |

`Mark` recibe cambios **aditivos**: `categoryId?` (a qué categoría aporta) y el índice
`@@unique([studentId, homeworkId])`. Postgres trata `NULL` como distinto, así que las
notas manuales sueltas (sin tarea) no se ven afectadas, pero la carrera de los tres
writers sobre la misma tarea+alumno queda imposibilitada a nivel de base de datos.

## 3. El motor de cálculo

`ReportCardsService` (en `modules/report-cards`) calcula la definitiva:

```
1 · promedio de categoría   catAvg = mean( value/maxValue por nota de la categoría )
2 · definitiva del periodo   periodoFinal = Σ(catAvg × peso) / Σ(peso de categorías con notas)
3 · definitiva del año        añoFinal    = Σ(periodoFinal × peso_periodo) / Σ(peso_periodo)
4 · proyección a escala       final = clamp(fracción × escala.maxValue, min, max)
5 · banda cualitativa         label = banda donde minValue ≤ final ≤ maxValue
```

**Fallback**: si una clase todavía no tiene categorías configuradas, el periodo se
calcula como promedio simple de las notas del periodo (por `Mark.period`). Así el
sistema funciona desde el primer día sin obligar a configurar categorías.

**Proyección a escala**: `fracción × maxValue` funciona tanto si la nota se guardó en
unidades de escala (4.5/5.0 → 0.9×5 = 4.5) como en puntos crudos (90/100 → 0.9×5 = 4.5).

## 4. Inmutabilidad del boletín

`POST /report-cards/generate` congela un snapshot: guarda el valor final y la etiqueta
de banda **vigentes al generarlo**, más el nombre de la escala. Recalcular notas
históricas nunca cambia un boletín ya emitido. Un boletín en estado `FINAL` no se puede
regenerar; `DRAFT`/`PUBLISHED` se pueden reemplazar hasta finalizar.

## 5. Writer único de `Mark`

`MarksService.upsertMark()` es la fuente única de verdad: idempotente por
`[studentId, homeworkId]` (upsert), registra auditoría y emite `MARK_PUBLISHED` de forma
consistente. `create`/`bulkCreate` propios ya enrutan por ahí. Los otros módulos que
escriben `Mark` directo (`homework-submissions`, `quiz-attempts`) **deben adoptar** este
método — `MarksService` se exporta desde `MarksModule` para eso. El índice único es la
red de seguridad mientras tanto. Contrato en `asignaciones-calificacion-en-linea.md §2`.

## 6. Endpoints

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET/POST/PATCH | `/academic-years` | `SUBJECTS_*` | CRUD de años; `:id/activate`, `:id/archive`, `:id/periods` |
| POST | `/academic-periods/:id/lock`·`/unlock` | `SUBJECTS_CREATE` | Cerrar/abrir un periodo |
| GET/POST/PATCH | `/grading-scales` | `SUBJECTS_*` | Escalas + bandas |
| GET/POST | `/grading-categories` | `MARKS_*` | Categorías por clase (profesor) |
| GET | `/report-cards/preview` | `MARKS_LIST` | Definitiva en vivo (periodo o año) |
| POST | `/report-cards/generate` | `MARKS_CREATE` | Congela el boletín |
| GET | `/report-cards/transcript` | `MARKS_LIST` | Consolidado del año |
| GET | `/report-cards`·`/:id` | `MARKS_LIST` | Listar / leer boletines |

**Permisos**: se reutilizan permisos existentes con la audiencia correcta
(`SUBJECTS_*` = admin institucional; `MARKS_*` = admin + profesor) para **no tocar el
`permissions.ts` compartido**. Lectura de boletines con scoping por rol dentro del
servicio (estudiante propio, acudiente sus hijos, profesor sus grupos, admin el tenant).

## 7. Frontend

- **Fuente única** de la definitiva en `lib/grading.ts` (`computeWeightedFinal`), usada
  por la grilla del profesor y `student-grades-table`. Antes eran dos fórmulas distintas.
- **Bugs corregidos** en `/profesor/calificaciones`: el filtro de periodo ya no esconde
  las tareas sin nota, y la definitiva respeta el filtro.
- **Boletín oficial** (`components/shared/report-card-view.tsx`): consume el motor
  inmutable del backend (escala real + banda), separado del cálculo local de edición.

## 8. Configuración por defecto (seed)

Colombia: escala 1.0–5.0 (aprueba 3.0) con bandas Bajo/Básico/Alto/Superior, y 4
periodos iguales (25% c/u). Todo configurable — el modelo es genérico para crecer a
LatAm y global.
