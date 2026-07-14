import { z } from "zod";

export const createConversationSchema = z.object({
  participantId: z.string().min(1),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  attachmentKey: z.string().min(1).max(500).optional(),
  attachmentName: z.string().min(1).max(200).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
