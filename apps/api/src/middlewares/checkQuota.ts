import { Request, Response, NextFunction } from 'express';
import {
  FREE_AI_QUOTA_PER_DAY,
  FREE_RUN_QUOTA_PER_DAY,
  PREMIUM_AI_QUOTA_PER_DAY,
  PREMIUM_RUN_QUOTA_PER_DAY,
  type PlanTier,
} from '@devstudy/shared';
import { redis } from '../config/redis.js';
import { sendError } from '../utils/response.js';

export type QuotaFeature = 'ai_questions' | 'code_run';

declare global {
  namespace Express {
    interface Request {
      quota?: {
        feature: QuotaFeature;
        used: number;
        limit: number;
        remaining: number;
      };
    }
  }
}

const QUOTA_LIMITS: Record<QuotaFeature, { FREE: number; PREMIUM: number }> = {
  ai_questions: {
    FREE: FREE_AI_QUOTA_PER_DAY,
    PREMIUM: PREMIUM_AI_QUOTA_PER_DAY,
  },
  code_run: {
    FREE: FREE_RUN_QUOTA_PER_DAY,
    PREMIUM: PREMIUM_RUN_QUOTA_PER_DAY,
  },
};

export function getQuotaRedisKey(feature: QuotaFeature, userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `quota:${feature}:${userId}:${today}`;
}

export async function getQuotaUsage(feature: QuotaFeature, userId: string, plan: PlanTier) {
  const limits = QUOTA_LIMITS[feature];
  const maxLimit = limits[plan] ?? limits.FREE;
  const key = getQuotaRedisKey(feature, userId);

  try {
    const raw = await redis.get(key);
    const used = raw ? parseInt(raw, 10) : 0;
    return {
      used: Math.min(used, maxLimit),
      rawUsed: used,
      limit: maxLimit,
      remaining: Math.max(0, maxLimit - used),
    };
  } catch {
    return {
      used: 0,
      rawUsed: 0,
      limit: maxLimit,
      remaining: maxLimit,
    };
  }
}

export function checkQuota(feature: QuotaFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Yêu cầu đăng nhập', 401, 'UNAUTHORIZED');
    }

    const { userId, plan } = req.user;
    const limits = QUOTA_LIMITS[feature];
    const maxLimit = limits[plan] ?? limits.FREE;

    const key = getQuotaRedisKey(feature, userId);

    try {
      const currentUsage = await redis.incr(key);

      if (currentUsage === 1) {
        await redis.expire(key, 86400); // 24 hours
      }

      if (currentUsage > maxLimit) {
        return sendError(
          res,
          `Bạn đã dùng hết hạn mức ${feature === 'ai_questions' ? 'câu hỏi AI' : 'lượt chạy code'} trong ngày hôm nay`,
          429,
          'QUOTA_EXCEEDED',
          {
            feature,
            plan,
            used: currentUsage,
            limit: maxLimit,
          }
        );
      }

      req.quota = {
        feature,
        used: currentUsage,
        limit: maxLimit,
        remaining: Math.max(0, maxLimit - currentUsage),
      };

      next();
    } catch (err) {
      // Nếu Redis lỗi thì không chặn người dùng
      console.error('Redis quota error:', err);
      next();
    }
  };
}
