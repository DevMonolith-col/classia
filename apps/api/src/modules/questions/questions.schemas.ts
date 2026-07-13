import { z } from "zod";

export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as const;

const optionSchema = z.object({
  text: z.string().min(1).max(300),
  isCorrect: z.boolean(),
  feedback: z.string().max(500).optional(),
});

export const createQuestionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    text: z.string().min(1).max(1000),
    points: z.number().min(0.1).max(100).optional(),
    options: z.array(optionSchema).max(10).optional(),
    imageKey: z.string().min(1).optional(),
    imageName: z.string().min(1).max(200).optional(),
  })
  .refine(
    (value) => {
      if (value.type === "SHORT_ANSWER") return true;
      if (!value.options || value.options.length < 2) return false;
      return value.options.some((option) => option.isCorrect);
    },
    { message: "Multiple choice and true/false questions need at least 2 options and one marked correct." },
  );

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    text: z.string().min(1).max(1000).optional(),
    points: z.number().min(0.1).max(100).optional(),
    options: z.array(optionSchema).max(10).optional(),
    imageKey: z.string().min(1).optional().nullable(),
    imageName: z.string().min(1).max(200).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
