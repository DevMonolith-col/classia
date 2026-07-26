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

/**
 * Un mensaje necesita texto **o** adjunto, no las dos cosas.
 *
 * `body` era `min(1)`, así que enviar solo un archivo daba 400 — y las columnas
 * `attachmentKey`/`attachmentName` existían en el modelo desde el principio sin que ninguna
 * pantalla las escribiera. Se relaja a `max(5000)` y la exigencia de "algo hay" pasa al refine.
 *
 * La clave y el nombre viajan juntos a propósito: con clave y sin nombre la burbuja queda con un
 * archivo que no se puede etiquetar, y `AttachmentPreviewDialog` decide por la extensión del
 * nombre si lo abre como PDF o como descarga.
 */
export const sendMessageSchema = z
  .object({
    body: z.string().max(5000),
    attachmentKey: z.string().min(1).max(500).optional(),
    attachmentName: z.string().min(1).max(200).optional(),
  })
  .refine((input) => input.body.trim().length > 0 || input.attachmentKey !== undefined, {
    message: "El mensaje necesita texto o un archivo adjunto.",
    path: ["body"],
  })
  .refine((input) => (input.attachmentKey === undefined) === (input.attachmentName === undefined), {
    message: "El adjunto necesita clave y nombre.",
    path: ["attachmentName"],
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const muteConversationSchema = z.object({
  muted: z.boolean(),
});

export type MuteConversationInput = z.infer<typeof muteConversationSchema>;

export const broadcastSchema = z.object({
  groupId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;
