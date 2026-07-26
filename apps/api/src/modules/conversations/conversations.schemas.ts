import { z } from "zod";

export const createConversationSchema = z.object({
  participantId: z.string().min(1),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

/**
 * Paginación por cursor del historial de un hilo.
 *
 * Cursor y no `skip`/`offset`: el hilo crece por el final mientras se lee hacia atrás, y con
 * offset un mensaje nuevo corre la ventana y hace que se repita o se salte una fila. El cursor
 * es el id del mensaje más viejo ya cargado, y se pide "lo anterior a este".
 */
export const listMessagesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  attachmentKey: z.string().min(1).max(500).optional(),
  attachmentName: z.string().min(1).max(200).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const broadcastSchema = z.object({
  groupId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;
