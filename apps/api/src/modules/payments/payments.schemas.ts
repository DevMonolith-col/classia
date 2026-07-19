import { z } from "zod"

export const createFeeConceptSchema = z.object({
  academicYearId: z.string().min(1),
  groupId: z.string().min(1).nullable().optional(), // null/omitido = aplica a todo el colegio
  name: z.string().min(3).max(150),
  description: z.string().max(1000).optional(),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
})
export type CreateFeeConceptInput = z.infer<typeof createFeeConceptSchema>

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
  paidAt: z.coerce.date().optional(),
  reference: z.string().max(200).optional(),
})
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const listInvoicesQuerySchema = z.object({
  status: z.enum(["PENDING", "PARTIAL", "PAID", "CANCELLED"]).optional(),
  groupId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
})
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>

export const financialSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
})
export type FinancialSummaryQuery = z.infer<typeof financialSummaryQuerySchema>
