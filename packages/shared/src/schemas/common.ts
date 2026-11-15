import { z } from 'zod';

export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
  details: z.any().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiResponseMetaSchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
  cursor: z.string().optional(),
  hasNext: z.boolean().optional(),
});
export type ApiResponseMeta = z.infer<typeof ApiResponseMetaSchema>;

export type ApiResponse<T> = {
  data: T;
  error?: null;
  meta?: ApiResponseMeta;
};

export type ApiErrorResponse = {
  data?: null;
  error: ApiError;
  meta?: ApiResponseMeta;
};
