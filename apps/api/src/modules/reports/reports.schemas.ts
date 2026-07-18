import { z } from "zod"

const REPORT_TYPES = ["ATTENDANCE", "GRADES", "STUDENTS", "TEACHERS", "COURSES", "FINANCIAL"] as const
const REPORT_FORMATS = ["PDF", "CSV"] as const

export const reportFiltersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
})
export type ReportFilters = z.infer<typeof reportFiltersSchema>

export const generateReportSchema = z.object({
  type: z.enum(REPORT_TYPES),
  format: z.enum(REPORT_FORMATS),
  filters: reportFiltersSchema.default({}),
})
export type GenerateReportInput = z.infer<typeof generateReportSchema>

export const previewReportSchema = generateReportSchema
export type PreviewReportInput = GenerateReportInput

export const toggleScheduleSchema = z.object({
  active: z.boolean(),
})
export type ToggleScheduleInput = z.infer<typeof toggleScheduleSchema>

export const createScheduleSchema = z.object({
  type: z.enum(REPORT_TYPES),
  format: z.enum(REPORT_FORMATS),
  filters: reportFiltersSchema.default({}),
  frequency: z.enum(["WEEKLY", "MONTHLY"]),
  recipients: z.array(z.string().email()).min(1).max(20),
})
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
