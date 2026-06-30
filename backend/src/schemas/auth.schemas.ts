import { z } from 'zod';

const emailSchema = z.string().email().max(320);

export const signupBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  display_name: z.string().trim().max(200).optional(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type SignupBody = z.infer<typeof signupBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
