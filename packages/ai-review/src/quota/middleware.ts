import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthenticatedStudentRequest } from '../contracts/ports.js';
import {
  QuotaExceededError,
  QuotaServiceUnavailableError,
  type QuotaMetric,
  type QuotaMetricStatus,
  type QuotaService,
} from './quota.service.js';

export interface QuotaAttachedRequest extends AuthenticatedStudentRequest {
  aiReviewQuota?: QuotaMetricStatus;
  user?: { userId: string };
}

export function applyQuotaHeaders(
  res: Response,
  status: Pick<QuotaMetricStatus, 'metric' | 'limit' | 'remaining' | 'resetAt'>
): void {
  res.setHeader('X-Quota-Metric', status.metric);
  res.setHeader('X-Quota-Limit', status.limit === null ? 'unlimited' : String(status.limit));
  res.setHeader(
    'X-Quota-Remaining',
    status.remaining === null ? 'unlimited' : String(status.remaining)
  );
  res.setHeader('X-Quota-Reset', status.resetAt);
}

export function sendQuotaExceededResponse(res: Response, err: QuotaExceededError) {
  applyQuotaHeaders(res, {
    metric: err.metric,
    limit: err.limit,
    remaining: err.remaining,
    resetAt: err.resetAt,
  });
  res.setHeader('Retry-After', String(err.retryAfterSeconds));

  return res.status(429).json({
    data: null,
    error: {
      message: err.message,
      code: err.code,
      status: 429,
      details: {
        metric: err.metric,
        plan: err.plan,
        period: err.period,
        limit: err.limit,
        used: err.used,
        remaining: err.remaining,
        reset_at: err.resetAt,
        retry_after_seconds: err.retryAfterSeconds,
      },
    },
  });
}

/**
 * Express middleware enforcing atomic DB quota consumption for `metric`.
 * Returns HTTP 429 with `Retry-After` & `X-Quota-*` headers when exhausted.
 */
export function requireQuota(
  quotaService: QuotaService,
  metric: QuotaMetric,
  cost: number = 1
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const qReq = req as QuotaAttachedRequest;
    const userId = qReq.aiReviewStudent?.userId ?? qReq.user?.userId;

    if (!userId) {
      return res.status(401).json({
        data: null,
        error: {
          message: 'Yêu cầu đăng nhập để kiểm tra hạn mức',
          code: 'UNAUTHORIZED',
          status: 401,
        },
      });
    }

    const requestIdHeader = req.headers['x-request-id'];
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;

    try {
      const status = await quotaService.consume(userId, metric, cost, { requestId });
      applyQuotaHeaders(res, status);
      qReq.aiReviewQuota = status;
      return next();
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return sendQuotaExceededResponse(res, err);
      }
      if (err instanceof QuotaServiceUnavailableError) {
        return res.status(503).json({
          data: null,
          error: {
            message: err.message,
            code: err.code,
            status: 503,
          },
        });
      }
      return next(err);
    }
  };
}
