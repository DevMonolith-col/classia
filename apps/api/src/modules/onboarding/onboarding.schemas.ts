import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const teacherImportRowSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  firstName: z.string().trim().min(1, "Nombre requerido").max(80),
  lastName: z.string().trim().min(1, "Apellido requerido").max(80),
});

export type TeacherImportRow = z.infer<typeof teacherImportRowSchema>;

export const studentImportRowSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre requerido").max(80),
  lastName: z.string().trim().min(1, "Apellido requerido").max(80),
  documentId: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  birthDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  grade: z.string().trim().min(1, "Grado requerido"),
  section: z.string().trim().min(1, "Sección requerida"),
  guardianEmail: z.preprocess(
    emptyToUndefined,
    z.string().trim().toLowerCase().email("Correo de acudiente inválido").optional(),
  ),
  guardianFirstName: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  guardianLastName: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
});

export type StudentImportRow = z.infer<typeof studentImportRowSchema>;

export type ImportRowResult = {
  row: number;
  status: "ok" | "error";
  message: string;
  entityId?: string;
};

export type ImportResult = {
  results: ImportRowResult[];
  summary: { total: number; ok: number; failed: number };
};
