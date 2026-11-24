import type { PlanCode } from '../contracts/events.js';
import type { LoggerPort } from '../contracts/ports.js';
import type { AiReviewPrismaClient } from '../db/client.js';
import {
  computeQuotaPeriod,
  type ComputedQuotaPeriod,
  type QuotaPeriodType,
} from './period.js';
import type { PlanResolverCache } from './plan-cache.js';

export const QUOTA_METRICS = ['exam_sets', 'llm_tokens'] as const;
export type QuotaMetric = (typeof QUOTA_METRICS)[number];

export interface QuotaMetricStatus {
  metric: QuotaMetric;
  plan: PlanCode;
  period: QuotaPeriodType;
  periodKey: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string;
  retryAfterSeconds: number;
  degraded?: boolean;
}

export interface QuotaSnapshot {
  plan: PlanCode;
  timezone: string;
  subscriptionStartedAt: string;
  quotas: Record<QuotaMetric, QuotaMetricStatus>;
}

export interface QuotaUsageMetadata {
  requestId?: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

export class QuotaExceededError extends Error {
  readonly status = 429;
  readonly code = 'QUOTA_EXCEEDED';
  readonly metric: QuotaMetric;
  readonly plan: PlanCode;
  readonly period: QuotaPeriodType;
  readonly periodKey: string;
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
  readonly resetAt: string;
  readonly retryAfterSeconds: number;

  constructor(params: {
    metric: QuotaMetric;
    plan: PlanCode;
    period: QuotaPeriodType;
    periodKey: string;
    limit: number;
    used: number;
    resetAt: string;
    retryAfterSeconds: number;
  }) {
    const label =
      params.metric === 'exam_sets'
        ? 'lượt tạo bộ đề ôn tập trong ngày'
        : 'hạn mức token AI trong chu kỳ tháng';
    super(`Bạn đã sử dụng hết ${label}. Vui lòng thử lại sau khi hạn mức được đặt lại.`);
    this.name = 'QuotaExceededError';
    this.metric = params.metric;
    this.plan = params.plan;
    this.period = params.period;
    this.periodKey = params.periodKey;
    this.limit = params.limit;
    this.used = params.used;
    this.remaining = Math.max(0, params.limit - params.used);
    this.resetAt = params.resetAt;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}

export class QuotaServiceUnavailableError extends Error {
  readonly status = 503;
  readonly code = 'QUOTA_SERVICE_UNAVAILABLE';

  constructor(message = 'Hệ thống kiểm tra hạn mức tạm thời gián đoạn. Vui lòng thử lại sau.') {
    super(message);
    this.name = 'QuotaServiceUnavailableError';
  }
}

export interface QuotaServiceOptions {
  prisma: AiReviewPrismaClient;
  planCache: PlanResolverCache;
  logger: LoggerPort;
  timezone: string;
  failMode: 'closed' | 'open';
  nowFn?: () => Date;
}

export class QuotaService {
  private readonly prisma: AiReviewPrismaClient;
  private readonly planCache: PlanResolverCache;
  private readonly logger: LoggerPort;
  private readonly timezone: string;
  private readonly failMode: 'closed' | 'open';
  private readonly nowFn: () => Date;

  constructor(options: QuotaServiceOptions) {
    this.prisma = options.prisma;
    this.planCache = options.planCache;
    this.logger = options.logger;
    this.timezone = options.timezone;
    this.failMode = options.failMode;
    this.nowFn = options.nowFn ?? (() => new Date());
  }

  private async resolvePlanAndLimit(userId: string, metric: QuotaMetric): Promise<{
    plan: PlanCode;
    subscriptionStartedAt: Date;
    limitValue: number | null;
    period: ComputedQuotaPeriod;
  }> {
    const subscription = await this.planCache.getPlanSubscription(userId);
    const plan: PlanCode = subscription.planCode;

    let planLimit = await this.prisma.planLimit.findUnique({
      where: { planCode_metric: { planCode: plan, metric } },
    });

    if (!planLimit && plan !== 'FREE') {
      planLimit = await this.prisma.planLimit.findUnique({
        where: { planCode_metric: { planCode: 'FREE', metric } },
      });
    }

    if (!planLimit) {
      throw new Error(`Missing plan_limits configuration for (${plan}, ${metric})`);
    }

    const periodType: QuotaPeriodType = planLimit.period === 'month' ? 'month' : 'day';
    const period = computeQuotaPeriod(
      periodType,
      this.nowFn(),
      subscription.startedAt,
      this.timezone
    );

    return {
      plan,
      subscriptionStartedAt: subscription.startedAt,
      limitValue: planLimit.limitValue,
      period,
    };
  }

  /**
   * Atomically consumes `amount` units for `(userId, metric)` in PostgreSQL and appends
   * an immutable `usage_events` row in the same ACID transaction.
   */
  async consume(
    userId: string,
    metric: QuotaMetric,
    amount: number = 1,
    meta: QuotaUsageMetadata = {}
  ): Promise<QuotaMetricStatus> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(`Quota consume amount must be a positive integer (got ${amount})`);
    }

    try {
      const { plan, limitValue, period } = await this.resolvePlanAndLimit(userId, metric);

      const result = await this.prisma.$transaction(async (tx) => {
        let rows: Array<{ used: number }>;

        if (limitValue === null) {
          rows = await tx.$queryRaw<Array<{ used: number }>>`
            INSERT INTO "ai_review"."usage_counters" ("user_id", "metric", "period_key", "used", "updated_at")
            VALUES (${userId}, ${metric}, ${period.periodKey}, ${amount}::int, NOW())
            ON CONFLICT ("user_id", "metric", "period_key")
            DO UPDATE SET
              "used" = "ai_review"."usage_counters"."used" + EXCLUDED."used",
              "updated_at" = NOW()
            RETURNING "used"
          `;
        } else {
          rows = await tx.$queryRaw<Array<{ used: number }>>`
            INSERT INTO "ai_review"."usage_counters" ("user_id", "metric", "period_key", "used", "updated_at")
            SELECT ${userId}, ${metric}, ${period.periodKey}, ${amount}::int, NOW()
            WHERE ${amount}::int <= ${limitValue}::int
            ON CONFLICT ("user_id", "metric", "period_key")
            DO UPDATE SET
              "used" = "ai_review"."usage_counters"."used" + EXCLUDED."used",
              "updated_at" = NOW()
            WHERE "ai_review"."usage_counters"."used" + EXCLUDED."used" <= ${limitValue}::int
            RETURNING "used"
          `;
        }

        if (rows.length === 0) {
          const existing = await tx.usageCounter.findUnique({
            where: {
              userId_metric_periodKey: {
                userId,
                metric,
                periodKey: period.periodKey,
              },
            },
            select: { used: true },
          });
          return { exceeded: true as const, currentUsed: existing?.used ?? 0 };
        }

        const newUsed = Number(rows[0].used);

        await tx.usageEvent.create({
          data: {
            userId,
            metric,
            amount,
            planCode: plan,
            periodKey: period.periodKey,
            limitSnapshot: limitValue,
            requestId: meta.requestId ?? null,
            modelId: meta.modelId ?? null,
            inputTokens: meta.inputTokens ?? 0,
            outputTokens: meta.outputTokens ?? 0,
            latencyMs: meta.latencyMs ?? 0,
          },
        });

        return { exceeded: false as const, newUsed };
      });

      if (result.exceeded) {
        throw new QuotaExceededError({
          metric,
          plan,
          period: period.period,
          periodKey: period.periodKey,
          limit: limitValue!,
          used: result.currentUsed,
          resetAt: period.resetAtIso,
          retryAfterSeconds: period.retryAfterSeconds,
        });
      }

      return {
        metric,
        plan,
        period: period.period,
        periodKey: period.periodKey,
        limit: limitValue,
        used: result.newUsed,
        remaining: limitValue === null ? null : Math.max(0, limitValue - result.newUsed),
        resetAt: period.resetAtIso,
        retryAfterSeconds: period.retryAfterSeconds,
      };
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        throw err;
      }
      return this.handleStoreError(err, metric);
    }
  }

  /**
   * Read-only pre-flight check verifying the user has at least `minRequired` units left.
   * Throws QuotaExceededError if exhausted.
   */
  async assertAvailable(
    userId: string,
    metric: QuotaMetric,
    minRequired: number = 1
  ): Promise<QuotaMetricStatus> {
    try {
      const status = await this.getMetricStatus(userId, metric);
      if (status.limit !== null && (status.remaining ?? 0) < minRequired) {
        throw new QuotaExceededError({
          metric,
          plan: status.plan,
          period: status.period,
          periodKey: status.periodKey,
          limit: status.limit,
          used: status.used,
          resetAt: status.resetAt,
          retryAfterSeconds: status.retryAfterSeconds,
        });
      }
      return status;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        throw err;
      }
      return this.handleStoreError(err, metric);
    }
  }

  /**
   * Unconditionally records actual post-call consumption (e.g. real LLM input + output tokens)
   * into both `usage_counters` and `usage_events` atomically so billing never drops spent tokens.
   */
  async recordActualUsage(
    userId: string,
    metric: QuotaMetric,
    amount: number,
    meta: QuotaUsageMetadata = {}
  ): Promise<QuotaMetricStatus> {
    const safeAmount = Math.max(0, Math.trunc(amount));
    const { plan, limitValue, period } = await this.resolvePlanAndLimit(userId, metric);

    const newUsed = await this.prisma.$transaction(async (tx) => {
      let currentUsed = 0;
      if (safeAmount > 0) {
        const rows = await tx.$queryRaw<Array<{ used: number }>>`
          INSERT INTO "ai_review"."usage_counters" ("user_id", "metric", "period_key", "used", "updated_at")
          VALUES (${userId}, ${metric}, ${period.periodKey}, ${safeAmount}::int, NOW())
          ON CONFLICT ("user_id", "metric", "period_key")
          DO UPDATE SET
            "used" = "ai_review"."usage_counters"."used" + EXCLUDED."used",
            "updated_at" = NOW()
          RETURNING "used"
        `;
        currentUsed = Number(rows[0]?.used ?? safeAmount);
      } else {
        const existing = await tx.usageCounter.findUnique({
          where: {
            userId_metric_periodKey: { userId, metric, periodKey: period.periodKey },
          },
          select: { used: true },
        });
        currentUsed = existing?.used ?? 0;
      }

      await tx.usageEvent.create({
        data: {
          userId,
          metric,
          amount: safeAmount,
          planCode: plan,
          periodKey: period.periodKey,
          limitSnapshot: limitValue,
          requestId: meta.requestId ?? null,
          modelId: meta.modelId ?? null,
          inputTokens: meta.inputTokens ?? 0,
          outputTokens: meta.outputTokens ?? 0,
          latencyMs: meta.latencyMs ?? 0,
        },
      });

      return currentUsed;
    });

    return {
      metric,
      plan,
      period: period.period,
      periodKey: period.periodKey,
      limit: limitValue,
      used: newUsed,
      remaining: limitValue === null ? null : Math.max(0, limitValue - newUsed),
      resetAt: period.resetAtIso,
      retryAfterSeconds: period.retryAfterSeconds,
    };
  }

  async getMetricStatus(userId: string, metric: QuotaMetric): Promise<QuotaMetricStatus> {
    const { plan, limitValue, period } = await this.resolvePlanAndLimit(userId, metric);
    const row = await this.prisma.usageCounter.findUnique({
      where: {
        userId_metric_periodKey: {
          userId,
          metric,
          periodKey: period.periodKey,
        },
      },
      select: { used: true },
    });

    const used = row?.used ?? 0;
    return {
      metric,
      plan,
      period: period.period,
      periodKey: period.periodKey,
      limit: limitValue,
      used,
      remaining: limitValue === null ? null : Math.max(0, limitValue - used),
      resetAt: period.resetAtIso,
      retryAfterSeconds: period.retryAfterSeconds,
    };
  }

  async getSnapshot(userId: string): Promise<QuotaSnapshot> {
    const subscription = await this.planCache.getPlanSubscription(userId);
    const [examSets, llmTokens] = await Promise.all([
      this.getMetricStatus(userId, 'exam_sets'),
      this.getMetricStatus(userId, 'llm_tokens'),
    ]);

    return {
      plan: subscription.planCode,
      timezone: this.timezone,
      subscriptionStartedAt: subscription.startedAt.toISOString(),
      quotas: {
        exam_sets: examSets,
        llm_tokens: llmTokens,
      },
    };
  }

  async handleUserDeleted(userId: string): Promise<void> {
    this.planCache.invalidate(userId);
    await this.prisma.usageCounter.deleteMany({ where: { userId } });
  }

  invalidatePlanCache(userId: string): void {
    this.planCache.invalidate(userId);
  }

  private handleStoreError(err: unknown, metric: QuotaMetric): QuotaMetricStatus {
    this.logger.error({ err, metric, failMode: this.failMode }, 'Quota store failure');
    if (this.failMode === 'closed') {
      throw new QuotaServiceUnavailableError();
    }

    const fallbackPeriod = computeQuotaPeriod('day', this.nowFn(), this.nowFn(), this.timezone);
    return {
      metric,
      plan: 'FREE',
      period: fallbackPeriod.period,
      periodKey: fallbackPeriod.periodKey,
      limit: null,
      used: 0,
      remaining: null,
      resetAt: fallbackPeriod.resetAtIso,
      retryAfterSeconds: fallbackPeriod.retryAfterSeconds,
      degraded: true,
    };
  }
}
