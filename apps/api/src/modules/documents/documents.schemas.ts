import { z } from "zod"

export const issueDocumentSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(["STUDY_CERTIFICATE", "REPORT_CARD"]),
  reportCardId: z.string().min(1).optional(), // requerido si type = REPORT_CARD
})
export type IssueDocumentInput = z.infer<typeof issueDocumentSchema>

export const updateTemplateSchema = z.object({
  name: z.string().min(3).max(150),
  contentHtml: z.string().min(20),
})
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
