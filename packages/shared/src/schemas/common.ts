import { z } from 'zod';

export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
