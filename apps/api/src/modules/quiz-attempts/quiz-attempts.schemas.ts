import { z } from "zod";

export const saveAnswerSchema = z
  .object({
    questionId: z.string().min(1),
    selectedOptionId: z.string().min(1).optional(),
    textAnswer: z.string().max(2000).optional(),
  })
  .refine((value) => value.selectedOptionId || value.textAnswer !== undefined, {
    message: "Provide either selectedOptionId or textAnswer.",
  });

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

export const gradeAnswerSchema = z.object({
  pointsAwarded: z.number().min(0),
});

export type GradeAnswerInput = z.infer<typeof gradeAnswerSchema>;
