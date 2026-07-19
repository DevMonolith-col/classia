# Notas y Reportes — Traspaso de sesión (2026-07-16)

> Documento de handoff para continuar el dominio de Notas y Reportes en una nueva
> sesión. Léelo junto con `notas-reportes-motor.md` (diseño técnico) y
> `asignaciones-calificacion-en-linea.md §2` (frontera con Entregas — NO tocar
> `homework-submissions`, `quiz-attempts` ni mensajería; `permissions.ts` es
> compartido y se coordina antes de editarlo).

## 1. HECHO — commiteado en `feature/notas-reportes-refactor`

| Commit | Contenido |
|---|---|
| `8442e8f` | `Mark` con `@@unique([studentId, homeworkId])` + `MarksService.upsertMark()` idempotente (writer único, auditoría + `MARK_PUBLISHED`), exportado para que Entregas/Quiz lo adopten. |
| `91dbb00` | `AcademicYear`, `AcademicPeriod` (N configurable, pesos suman 100%, `lockedAt`), `GradingScale`+bandas (genérica), `GradingCategory` por clase (profesor). Seed colombiano: escala 1.0–5.0 aprueba 3.0, 4 periodos 25%. Endpoints con permisos existentes (`SUBJECTS_*`/`MARKS_*`). |
| `53ed8a3` | Motor de definitivas (categoría→periodo→año, proyección a escala, banda cualitativa, fallback a promedio simple sin categorías) + `ReportCard`/`ReportCardLine` inmutables (FINAL no se regenera). Endpoints: `preview`, `generate`, `transcript`, list/read con scoping por rol. |
| `6923f70` | Bugs de la grilla corregidos (filtro de periodo ya no esconde tareas sin nota; definitiva respeta el filtro), fórmula única en `lib/grading.ts`, vista de boletín (`report-card-view.tsx`) consumiendo el motor. |
| `0577d96` | Página `/admin/configuracion-academica` (periodos+pesos+lock+escala) + `notas-reportes-motor.md`. |

**Verificado end-to-end**: seed OK por API; motor: 4.0/5.0 → definitiva 4.0 banda
"Alto"; boletín en UI (3.8 "Básico"); página de config funcionando.

**Decisiones tomadas con el usuario** (no re-preguntar):
- Categorías ponderadas **por profesor en su clase** (`groupId+subjectId+teacherId+periodId`).
- Escala **genérica** (crecerá a LatAm/global); Colombia es solo el seed por defecto.
- Periodos **configurables**, default 4×25%.
- `MarksService` = writer único + constraint, confirmado.
- Commits: Conventional Commits, atómicos, **sin auto-atribución** (sin "by Claude").

## 2. HECHO — soporte multi-año (commit `febc270`)

Cerrado el 2026-07-16: `Mark` y `Homework` llevan `academicYearId` (toda escritura
resuelve el año activo; sin año activo se rechaza con `ForbiddenException`); las
listas filtran por año activo por defecto y aceptan `academicYearId` explícito para
históricos; `bulkCreate` también ancla al año (gap corregido); migración idempotente
(la BD dev venía de `db push`) + índices; backfill ejecutado (7 homework, 5 marks →
año 2026); selector de año en la grilla del profesor y vista de auditoría del admin
(`/admin/calificaciones`: filtros año/curso/profesor/materia/periodo + boletín por
estudiante). Verificado en navegador con ambos roles.

## 3. PENDIENTE — mejoras solicitadas (nivel competitivo, ref. Zeti)

Objetivo del usuario: reportes de clase mundial. Prioridades expresadas:

1. **Histórico para el rector** — AVANZADO: `/admin/calificaciones` es
   estudiante-céntrica (combobox de estudiante con búsqueda por nombre/documento;
   al elegirlo: resumen por materias con la definitiva oficial del motor + banda,
   y cada materia se expande al desarrollo de notas individuales). Filtros
   año/curso/estudiante/profesor/materia/periodo. Seed con año 2025 archivado
   completo (notas 4 periodos + boletines FINAL) para demo del histórico. Falta:
   **comparación entre años** lado a lado.
2. **Generación masiva de boletines** — HECHO (commit `03ee42a`):
   `POST /report-cards/generate-bulk` (grupo o colegio, periodo o año; omitidos
   reportados sin abortar el lote) + botón "Generar boletines" en
   `/admin/calificaciones` que respeta los filtros. Falta solo: opción de emitir
   como `FINAL` desde la UI (el backend ya acepta `status`).
3. **Boletín PDF descargable/imprimible** (para padres): plantilla con logo del
   colegio, escala, bandas, observaciones por materia y firma.
4. **UI del profesor para configurar sus categorías** por clase (backend listo:
   `GET/POST /grading-categories`); hoy no hay pantalla.
5. **Estadísticas agregadas**: promedio del grupo por materia, distribución por
   bandas, ranking/percentil, tasa de aprobación por periodo — para rector y
   coordinador (dashboard de reportes).
6. **Transcript multi-año del estudiante** (historial completo de su paso por el
   colegio) visible para alumno/acudiente/admin.
7. **Adopción de `upsertMark()`** por `homework-submissions` y `quiz-attempts` —
   es del agente de Entregas (contrato listo); coordinar, no hacer.

## 4. Cómo arrancar la próxima sesión

```
1. git status  →  revisar el diff en progreso (sección 2) antes de nada.
2. Docker Desktop arriba → docker compose up -d  (Postgres en puerto 5434).
3. pnpm install && (packages/database) pnpm run db:migrate
4. Cerrar el trabajo multi-año (sección 2), commitearlo.
5. Atacar la sección 3 en orden (1→6), con plan/artifact primero si es grande.
```

Credenciales demo: `rector@demo.classia.com.co` / password del seed (`seed.ts`),
tenant `demo`. API 3001, web 3000 (`.claude/launch.json`).
