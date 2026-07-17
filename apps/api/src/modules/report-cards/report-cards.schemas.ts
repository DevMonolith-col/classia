import { z } from "zod";

export const previewQuerySchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
  periodId: z.string().min(1).optional(), // ausente = boletín anual consolidado
});
export type PreviewQuery = z.infer<typeof previewQuerySchema>;

export const generateReportCardSchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
  periodId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "FINAL"]).optional(),
});
export type GenerateReportCardInput = z.infer<typeof generateReportCardSchema>;

export const generateBulkSchema = z.object({
  groupId: z.string().min(1).optional(), // ausente = todos los grupos del colegio
  academicYearId: z.string().min(1).optional(),
  periodId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "FINAL"]).optional(),
});
export type GenerateBulkInput = z.infer<typeof generateBulkSchema>;

export const listReportCardsQuerySchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
});
export type ListReportCardsQuery = z.infer<typeof listReportCardsQuerySchema>;

export const transcriptQuerySchema = z.object({
  academicYearId: z.string().min(1).optional(),
});
export type TranscriptQuery = z.infer<typeof transcriptQuerySchema>;
