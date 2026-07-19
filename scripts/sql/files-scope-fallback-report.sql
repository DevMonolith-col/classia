-- Reporte de lectura sobre files.scope_fallback (ver
-- apps/api/src/modules/files/files-data-scope.guard.ts): cada fila es un
-- fileKey que un agente impersonado pidió y que NO resolvió a ninguna de las
-- 8 entidades dueñas conocidas (Homework, Question, SupportTicket,
-- TicketComment, HomeworkSubmission, ConversationMessage, DocumentIssuance,
-- GeneratedReport) — por eso cayó al fallback conservador DATOS_PERSONALES.
--
-- Propósito: dimensionar la brecha con datos reales antes de decidir si
-- amerita construir un registro exhaustivo fileKey -> entidad (en vez de la
-- búsqueda por tablas actual). Solo lectura — no cambia el comportamiento del
-- fallback en sí.
--
-- Uso: psql -f scripts/sql/files-scope-fallback-report.sql, o pegar cada
-- bloque suelto en cualquier cliente SQL contra la base de producción.
--
-- Estado al cerrar este turno (entorno de desarrollo, no producción): 1 solo
-- evento en el historial, generado por una prueba propia durante la
-- verificación de la instrumentación (no por tráfico orgánico). Con N=1 no
-- hay señal suficiente para decidir nada — recomendación: volver a correr
-- este mismo archivo contra producción después de unas semanas de tráfico
-- real de soporte antes de decidir si vale la pena construir el registro
-- exhaustivo.

-- 1) Resumen: volumen, fileKeys distintos, tickets y colegios implicados.
SELECT
  count(*)                                    AS total_eventos,
  count(DISTINCT "entityId")                  AS file_keys_distintos,
  count(DISTINCT "newValues"->>'ticketId')    AS tickets_implicados,
  count(DISTINCT "tenantId")                  AS colegios_implicados,
  min("createdAt")                            AS primer_evento,
  max("createdAt")                            AS ultimo_evento
FROM audit_logs
WHERE action = 'files.scope_fallback';

-- 2) Detalle por evento: fileKey, prefijo (tenants/<tenantId>/, el único
--    patrón posible dado cómo files.service.ts#upload genera la clave) y
--    extensión — para ver si el fallback concentra en algún tipo de archivo.
SELECT
  "entityId"                                                          AS file_key,
  split_part("entityId", '/', 1) || '/' || split_part("entityId", '/', 2) AS prefijo,
  regexp_replace("entityId", '.*\.', '')                              AS extension,
  "tenantId",
  "newValues"->>'ticketId'                                            AS ticket_id,
  "createdAt"
FROM audit_logs
WHERE action = 'files.scope_fallback'
ORDER BY "createdAt" DESC;

-- 3) Volumen por semana — para ver si la brecha crece, es estable o son
--    eventos aislados sin patrón temporal.
SELECT
  date_trunc('week', "createdAt") AS semana,
  count(*)                        AS eventos,
  count(DISTINCT "tenantId")      AS colegios
FROM audit_logs
WHERE action = 'files.scope_fallback'
GROUP BY 1
ORDER BY 1 DESC;

-- 4) Top colegios por volumen — si la brecha se concentra en pocos tenants,
--    el registro exhaustivo podría no valer la pena para toda la base.
SELECT
  "tenantId",
  count(*) AS eventos
FROM audit_logs
WHERE action = 'files.scope_fallback'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20;
