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

// DAYS: se repite cada intervalValue días (7 = semanal, 15 = quincenal...).
// MONTHLY: se repite cada intervalValue meses, el día dayOfMonth - acotado a
// 1-28 para no toparse con meses cortos (ni todos los meses tienen día 30/31).
const recurrenceSchema = z
  .discriminatedUnion("frequencyType", [
    z.object({ frequencyType: z.literal("DAYS"), intervalValue: z.coerce.number().int().min(1).max(180) }),
    z.object({
      frequencyType: z.literal("MONTHLY"),
      intervalValue: z.coerce.number().int().min(1).max(12),
      dayOfMonth: z.coerce.number().int().min(1).max(28),
    }),
  ])

export const createScheduleSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    format: z.enum(REPORT_FORMATS),
    filters: reportFiltersSchema.default({}),
    recipients: z.array(z.string().email()).min(1).max(20),
  })
  .and(recurrenceSchema)
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>

export const updateScheduleSchema = z.object({ recipients: z.array(z.string().email()).min(1).max(20) }).and(recurrenceSchema)
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
