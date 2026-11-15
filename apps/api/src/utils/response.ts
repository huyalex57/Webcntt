import { Response } from 'express';
import { ApiResponseMeta } from '@devstudy/shared';

export function sendSuccess<T>(res: Response, data: T, status = 200, meta?: ApiResponseMeta) {
  return res.status(status).json({
    data,
    error: null,
    ...(meta ? { meta } : {}),
  });
}

export function sendError(res: Response, message: string, status = 400, code?: string, details?: any) {
  return res.status(status).json({
    data: null,
    error: {
      message,
      code,
      status,
      ...(details ? { details } : {}),
    },
  });
}
