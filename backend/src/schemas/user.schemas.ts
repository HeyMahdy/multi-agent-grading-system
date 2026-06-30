import { z } from 'zod';
export const updateMyProfileBodySchema = z
  .object({
    display_name: z.string().trim().max(200).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type UpdateMyProfileBody = z.infer<typeof updateMyProfileBodySchema>;
