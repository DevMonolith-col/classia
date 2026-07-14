import { z } from "zod";

export const submitHomeworkSchema = z.object({
  attachmentKey: z.string().min(1),
  attachmentName: z.string().min(1).max(200),
});

export type SubmitHomeworkInput = z.infer<typeof submitHomeworkSchema>;

export const gradeSubmissionSchema = z
  .object({
    value: z.number().min(0),
    maxValue: z.number().min(1).max(1000).optional(),
    feedbackComment: z.string().max(2000).optional(),
    feedbackKey: z.string().min(1).optional(),
    feedbackName: z.string().min(1).max(200).optional(),
  })
  .refine((data) => data.value <= (data.maxValue ?? 100), {
    message: "value cannot exceed maxValue.",
    path: ["value"],
  });

export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
