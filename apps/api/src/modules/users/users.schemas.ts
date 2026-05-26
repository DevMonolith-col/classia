import { MembershipStatus, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  status: z.nativeEnum(UserStatus).optional(),
  tenantId: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  membershipStatus: z.nativeEnum(MembershipStatus).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    email: z.string().email().transform((email) => email.toLowerCase()).optional(),
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createMembershipSchema = z.object({
  tenantId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(MembershipStatus).optional(),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;

export const updateMembershipSchema = z
  .object({
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(MembershipStatus).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
