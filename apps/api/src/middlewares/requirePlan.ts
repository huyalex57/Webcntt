import { Request, Response, NextFunction } from 'express';
import { PlanTier, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { sendError } from '../utils/response.js';

export function requirePlan(requiredTier: PlanTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Yêu cầu đăng nhập', 401, 'UNAUTHORIZED');
    }

    if (requiredTier === PlanTier.FREE) {
      return next();
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId: req.user.userId },
    });

    const isExpired = sub?.expiresAt && sub.expiresAt < new Date();
    const isActive = sub && sub.status === SubscriptionStatus.ACTIVE && !isExpired;

    if (!isActive || sub.tier !== PlanTier.PREMIUM) {
      return sendError(
        res,
        'Tính năng này yêu cầu gói dịch vụ PREMIUM',
        403,
        'UPGRADE_REQUIRED',
        { requiredTier, currentTier: sub?.tier || PlanTier.FREE }
      );
    }

    next();
  };
}
