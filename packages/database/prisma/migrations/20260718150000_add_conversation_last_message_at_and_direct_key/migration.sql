-- Conversation.lastMessageAt: evita traer todos los mensajes de todas las
-- conversaciones solo para ordenar/previsualizar la lista (N+1 / carga
-- excesiva en memoria). Se ordena y limita en la propia consulta de Postgres.
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);

UPDATE "conversations" c
SET "lastMessageAt" = COALESCE(
  (SELECT MAX(cm."createdAt") FROM "conversation_messages" cm WHERE cm."conversationId" = c.id AND cm."deletedAt" IS NULL),
  c."createdAt"
)
WHERE c."lastMessageAt" IS NULL;

ALTER TABLE "conversations" ALTER COLUMN "lastMessageAt" SET DEFAULT now();
ALTER TABLE "conversations" ALTER COLUMN "lastMessageAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "conversations_tenantId_lastMessageAt_idx" ON "conversations"("tenantId", "lastMessageAt");

-- Conversation.directKey: clave determinística "userIdMenor:userIdMayor"
-- (solo para type = DIRECT) que delega a la BD el control de concurrencia de
-- "crear el hilo 1:1 si no existe" (antes: findFirst + create sin
-- transacción, con condición de carrera real ante peticiones simultáneas).
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "directKey" TEXT;

UPDATE "conversations" c
SET "directKey" = sub.direct_key
FROM (
  SELECT cm."conversationId" AS conv_id,
         string_agg(cm."userId"::text, ':' ORDER BY cm."userId") AS direct_key
  FROM "conversation_members" cm
  JOIN "conversations" cc ON cc.id = cm."conversationId"
  WHERE cc.type = 'DIRECT'
  GROUP BY cm."conversationId"
  HAVING count(*) = 2
) sub
WHERE c.id = sub.conv_id AND c."directKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_tenantId_directKey_key" ON "conversations"("tenantId", "directKey");
