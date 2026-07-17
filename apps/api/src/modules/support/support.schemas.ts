import { z } from "zod"

export const createTicketSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  category: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
})

export type CreateTicketDto = z.infer<typeof createTicketSchema>

export const updateTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]),
})

export type UpdateTicketStatusDto = z.infer<typeof updateTicketStatusSchema>

export const createCommentSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().default(false),
})

export type CreateCommentDto = z.infer<typeof createCommentSchema>

export const assignTicketSchema = z.object({
  assigneeId: z.string().nullable(),
})

export type AssignTicketDto = z.infer<typeof assignTicketSchema>
