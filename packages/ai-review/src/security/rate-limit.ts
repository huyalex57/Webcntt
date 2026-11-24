import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthenticatedStudentRequest } from '../contracts/ports.js';
import type { AuditService } from './audit.service.js';

export interface UserRateLimitOptions {
  keyPrefix: string;
  windowSeconds: number;
  maxRequests: number;
  auditService?: AuditService;
  resource?: string;
  nowFn?: () => Date;
}

interface WindowBucket {
  count: number;
  resetAtMs: number;
}

/**
 * Self-contained fixed-window per-user rate limiter (no external Redis coupling).
 */
export function createUserRateLimiter(options: UserRateLimitOptions): RequestHandler {
  const buckets = new Map<string, WindowBucket>();
  const windowMs = options.windowSeconds * 1000;
  const nowFn = options.nowFn ?? (() => new Date());

  const pruneStale = (nowMs: number) => {
    if (buckets.size < 2000) return;
    for (const [k, b] of buckets.entries()) {
      if (b.resetAtMs <= nowMs) buckets.delete(k);
    }
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const student = (req as AuthenticatedStudentRequest).aiReviewStudent;
    const identity = student?.userId
      ? `u:${student.userId}`
      : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const key = `${options.keyPrefix}:${identity}`;
    const nowMs = nowFn().getTime();

    pruneStale(nowMs);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAtMs <= nowMs) {
      bucket = { count: 0, resetAtMs: nowMs + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000));

    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', new Date(bucket.resetAtMs).toISOString());

    if (bucket.count > options.maxRequests) {
      res.setHeader('Retry-After', String(retryAfterSec));

      const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
      await options.auditService?.recordSafe({
        actorType: 'student',
        userId: student?.userId ?? null,
        action: 'security.rate_limit_exceeded',
        resource: options.resource ?? options.keyPrefix,
        outcome: 'DENY',
        requestId: reqId,
        meta: { limit: options.maxRequests, windowSeconds: options.windowSeconds },
      });

      return res.status(429).json({
        data: null,
        error: {
          message: 'Bạn gửi yêu cầu quá nhanh. Vui lòng chờ một chút rồi thử lại.',
          code: 'RATE_LIMIT_EXCEEDED',
          status: 429,
          details: {
            limit: options.maxRequests,
            retry_after_seconds: retryAfterSec,
          },
        },
      });
    }

    return next();
  };
}
