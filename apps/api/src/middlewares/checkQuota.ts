import { Request, Response, NextFunction } from 'express';
import {
  FREE_AI_QUOTA_PER_DAY,
  FREE_RUN_QUOTA_PER_DAY,
  PREMIUM_AI_QUOTA_PER_DAY,
  PREMIUM_RUN_QUOTA_PER_DAY,
} from '@devstudy/shared';
import { redis } from '../config/redis.js';
import { sendError } from '../utils/response.js';

export type QuotaFeature = 'ai_questions' | 'code_run';

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

export function checkQuota(feature: QuotaFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Yêu cầu đăng nhập', 401, 'UNAUTHORIZED');
    }

    const { userId, plan } = req.user;
    const limits = QUOTA_LIMITS[feature];
    const maxLimit = limits[plan] ?? limits.FREE;

    const today = new Date().toISOString().slice(0, 10);
    const key = `quota:${feature}:${userId}:${today}`;

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

      next();
    } catch (err) {
      // Nếu Redis lỗi thì không chặn người dùng
      console.error('Redis quota error:', err);
      next();
    }
  };
}
