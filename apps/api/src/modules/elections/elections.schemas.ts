import { z } from "zod"

export const createElectionSchema = z
  .object({
    title: z.string().min(3).max(150),
    description: z.string().max(2000).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    allowBlank: z.boolean().default(true),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "La fecha de cierre debe ser posterior a la de inicio",
    path: ["endDate"],
  })
export type CreateElectionInput = z.infer<typeof createElectionSchema>

// allowBlank queda fuera a propósito: cambia si existe o no el candidato de
// voto en blanco, y reconciliar eso después de creada la elección agrega
// complejidad para un caso de uso raro (recrear la elección en DRAFT es
// gratis, no cuesta nada pedirle al Rector que la rehaga si se equivocó ahí).
export const updateElectionSchema = z
  .object({
    title: z.string().min(3).max(150),
    description: z.string().max(2000).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "La fecha de cierre debe ser posterior a la de inicio",
    path: ["endDate"],
  })
export type UpdateElectionInput = z.infer<typeof updateElectionSchema>

export const addCandidateSchema = z.object({
  studentId: z.string().min(1).nullable(), // null = representa el voto en blanco
  candidateNumber: z.coerce.number().int().positive(),
  slogan: z.string().max(300).optional(),
  photoUrl: z.string().max(2000).optional(),
})
export type AddCandidateInput = z.infer<typeof addCandidateSchema>

export const updateElectionStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "PUBLISHED"]),
})
export type UpdateElectionStatusInput = z.infer<typeof updateElectionStatusSchema>

export const castVoteSchema = z.object({
  candidateId: z.string().min(1).nullable(), // null = voto en blanco
})
export type CastVoteInput = z.infer<typeof castVoteSchema>
