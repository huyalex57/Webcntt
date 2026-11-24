import { SubscriptionStatus } from '@prisma/client';
import type {
  PlanResolverPort,
  StudentPlanSubscription,
} from '@devstudy/ai-review/contracts';
import { prisma } from '../../../config/prisma.js';

export function createPlanResolverAdapter(): PlanResolverPort {
  return {
    async getPlanSubscription(userId: string): Promise<StudentPlanSubscription> {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          subscription: {
            select: {
              tier: true,
              status: true,
              startedAt: true,
              expiresAt: true,
            },
          },
        },
      });

      const sub = user?.subscription;
      const now = new Date();
      const isExpired = Boolean(sub?.expiresAt && sub.expiresAt <= now);
      const isActive = Boolean(sub && sub.status === SubscriptionStatus.ACTIVE && !isExpired);

      if (isActive && sub) {
        return {
          planCode: sub.tier,
          startedAt: sub.startedAt,
          expiresAt: sub.expiresAt,
        };
      }

      return {
        planCode: 'FREE',
        startedAt: sub?.startedAt ?? user?.createdAt ?? now,
        expiresAt: null,
      };
    },
  };
}
