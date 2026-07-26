-- Backfill de "marks"."academicYearId".
--
-- La columna se agregó nullable el 2026-07-16
-- (20260716230000_scope_marks_homework_to_academic_year) sin backfill ni default, y
-- dos de los writers de Mark (homework-submissions, quiz-attempts) nunca la setearon.
-- Toda lectura de notas filtra por año -- incluida la del boletín
-- (report-cards.service.ts: `where { studentId, academicYearId: year.id, isPublished }`)
-- así que una nota con año nulo es invisible para el alumno, para el acudiente y para
-- el boletín, aunque exista en la tabla.
--
-- El código ya no produce filas nuevas con año nulo (MarksService.resolveMarkYearId);
-- esta migración repara las que quedaron.
--
-- Idempotente: solo toca filas con "academicYearId" IS NULL, así que re-correrla no
-- hace nada.

-- Paso 1 -- las notas ligadas a una tarea heredan el año de la tarea.
--
-- Es la fuente más autoritativa que hay: "Mark"."date" tiene default now(), así que
-- guiarse por la fecha archivaría en el año equivocado una tarea del año pasado
-- calificada tarde (o recalificada). El año de la tarea no tiene ese problema.
UPDATE "marks" m
SET "academicYearId" = h."academicYearId"
FROM "homework" h
WHERE m."homeworkId" = h."id"
  AND m."academicYearId" IS NULL
  AND h."academicYearId" IS NOT NULL;

-- Paso 2 -- el resto, por rango de fechas del año académico.
--
-- Cubre las notas manuales (homeworkId nulo, nunca tuvieron tarea de dónde heredar) y
-- las tareas anteriores al 2026-07-16, que tampoco tienen año propio.
--
-- Subconsulta con ORDER BY + LIMIT en vez de un JOIN: si un colegio llegara a tener
-- dos años académicos con rangos solapados, un JOIN dejaría el resultado a criterio
-- del planner. Así es determinista -- gana el año que empezó más tarde, que es el que
-- contiene la fecha de forma más específica.
UPDATE "marks" m
SET "academicYearId" = (
  SELECT y."id"
  FROM "academic_years" y
  WHERE y."tenantId" = m."tenantId"
    AND m."date" >= y."startDate"
    AND m."date" <= y."endDate"
  ORDER BY y."startDate" DESC
  LIMIT 1
)
WHERE m."academicYearId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "academic_years" y
    WHERE y."tenantId" = m."tenantId"
      AND m."date" >= y."startDate"
      AND m."date" <= y."endDate"
  );

-- Lo que no matchee ningún año queda NULL a propósito.
--
-- La alternativa sería empujarlas al año activo del colegio, y eso es peor que
-- dejarlas visibles como pendientes: metería notas de fechas arbitrarias dentro del
-- año en curso y corrompería los boletines de ese año. Una nota cuya fecha no cae en
-- ningún año académico declarado es un dato que necesita revisión humana, no una
-- suposición. Para encontrarlas:
--
--   SELECT m."tenantId", m."id", m."date", m."title"
--   FROM "marks" m WHERE m."academicYearId" IS NULL;
