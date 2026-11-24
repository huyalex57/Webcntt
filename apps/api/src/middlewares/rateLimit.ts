import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { sendError } from '../utils/response.js';

export interface RateLimitOptions {
  keyPrefix: string;
  windowSeconds: number;
  maxRequests: number;
}

export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userPart = req.user?.userId ? `u:${req.user.userId}` : `ip:${ip}`;
    const key = `ratelimit:${options.keyPrefix}:${userPart}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - count)));

      if (count > options.maxRequests) {
        const ttl = await redis.ttl(key);
        return sendError(
          res,
          'Bạn gửi yêu cầu quá nhanh. Vui lòng chờ một chút rồi thử lại.',
          429,
          'RATE_LIMIT_EXCEEDED',
          {
            retryAfterSeconds: ttl > 0 ? ttl : options.windowSeconds,
            limit: options.maxRequests,
          }
        );
      }

      next();
    } catch (err) {
      // Fail open if Redis is temporarily unavailable
      console.error('Rate limit Redis error:', err);
      next();
    }
  };
}
