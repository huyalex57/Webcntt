import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response.js';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errorDetails = (result.error as ZodError).format();
      return sendError(res, 'Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', errorDetails);
    }
    req.body = result.data;
    next();
  };
}
