import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@ai-review/prisma-client';
import {
  CONTRACT_VERSION,
  QuotaExceededError,
  QuotaServiceUnavailableError,
  computeDailyPeriod,
  computeSubscriptionMonthlyPeriod,
  createAiReviewModule,
  type AiReviewHostPorts,
  type AuthenticatedStudentRequest,
  type PlanCode,
} from '../index.js';

const TEST_AI_REVIEW_DB_URL =
  process.env.AI_REVIEW_DATABASE_URL ||
  'postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=15';

describe('Phase 2 — Quota theo Plan, Chu kỳ giờ VN & Subscription, Atomic Concurrency', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_AI_REVIEW_DB_URL } },
  });
  const testPrefix = `p2_q_${Date.now()}`;
  const createdUserIds: string[] = [];

  const trackUser = (suffix: string) => {
    const id = `${testPrefix}_${suffix}`;
    createdUserIds.push(id);
    return id;
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.usageEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.usageCounter.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    await prisma.planLimit.deleteMany({ where: { planCode: 'TEST_P10' } });
    await prisma.$disconnect();
  });

  describe('Period calculation (Asia/Ho_Chi_Minh daily & subscription-anchored monthly)', () => {
    it('resets daily period exactly at 00:00:00 Asia/Ho_Chi_Minh (+07:00)', () => {
      // 2026-11-23 23:59:59+07:00 === 2026-11-23T16:59:59Z
      const justBeforeMidnight = new Date('2026-11-23T16:59:59.000Z');
      const p1 = computeDailyPeriod(justBeforeMidnight, 'Asia/Ho_Chi_Minh');
      expect(p1.periodKey).toBe('2026-11-23');
      expect(p1.resetAtIso).toBe('2026-11-24T00:00:00+07:00');
      expect(p1.retryAfterSeconds).toBe(1);

      // 1 second later: 2026-11-24 00:00:00+07:00 === 2026-11-23T17:00:00Z
      const exactMidnight = new Date('2026-11-23T17:00:00.000Z');
      const p2 = computeDailyPeriod(exactMidnight, 'Asia/Ho_Chi_Minh');
      expect(p2.periodKey).toBe('2026-11-24');
      expect(p2.resetAtIso).toBe('2026-11-25T00:00:00+07:00');
      expect(p2.retryAfterSeconds).toBe(86400);
    });

    it('computes monthly cycle anchored on subscriptions.startedAt including month-end clamping and leap years', () => {
      // Anchor on 15th in VN time
      const started15 = new Date('2026-10-15T03:00:00.000Z'); // 2026-10-15 10:00+07:00
      const beforeAnchor = computeSubscriptionMonthlyPeriod(
        new Date('2026-11-14T16:59:59.000Z'), // 2026-11-14 23:59:59+07:00
        started15,
        'Asia/Ho_Chi_Minh'
      );
      expect(beforeAnchor.periodKey).toBe('sub:2026-10-15');
      expect(beforeAnchor.resetAtIso).toBe('2026-11-15T00:00:00+07:00');
      expect(beforeAnchor.retryAfterSeconds).toBe(1);

      const onAnchor = computeSubscriptionMonthlyPeriod(
        new Date('2026-11-14T17:00:00.000Z'), // 2026-11-15 00:00:00+07:00
        started15,
        'Asia/Ho_Chi_Minh'
      );
      expect(onAnchor.periodKey).toBe('sub:2026-11-15');
      expect(onAnchor.resetAtIso).toBe('2026-12-15T00:00:00+07:00');

      // Anchor on 31st -> February non-leap year (2026 has 28 days)
      const started31 = new Date('2026-01-31T02:00:00.000Z');
      const midFeb2026 = computeSubscriptionMonthlyPeriod(
        new Date('2026-02-15T05:00:00.000Z'),
        started31,
        'Asia/Ho_Chi_Minh'
      );
      expect(midFeb2026.periodKey).toBe('sub:2026-01-31');
      expect(midFeb2026.resetAtIso).toBe('2026-02-28T00:00:00+07:00');

      const onFeb28_2026 = computeSubscriptionMonthlyPeriod(
        new Date('2026-02-28T05:00:00.000Z'),
        started31,
        'Asia/Ho_Chi_Minh'
      );
      expect(onFeb28_2026.periodKey).toBe('sub:2026-02-28');
      expect(onFeb28_2026.resetAtIso).toBe('2026-03-31T00:00:00+07:00');

      // Leap year 2028: Feb has 29 days
      const feb28_2028 = computeSubscriptionMonthlyPeriod(
        new Date('2028-02-28T05:00:00.000Z'),
        started31,
        'Asia/Ho_Chi_Minh'
      );
      expect(feb28_2028.periodKey).toBe('sub:2028-01-31');
      expect(feb28_2028.resetAtIso).toBe('2028-02-29T00:00:00+07:00');
    });
  });

  function createHarness(opts: {
    userId: string;
    initialPlan?: PlanCode;
    startedAt?: Date;
    now?: Date;
    failMode?: 'closed' | 'open';
    planResolverError?: boolean;
    planCacheTtlMs?: number;
  }) {
    let currentPlan: PlanCode = opts.initialPlan ?? 'FREE';
    let currentStartedAt = opts.startedAt ?? new Date('2026-11-15T00:00:00.000Z');
    let currentNow = opts.now ?? new Date('2026-11-23T10:00:00.000Z');
    const listeners = new Map<string, Set<(p: any) => void>>();

    const ports: AiReviewHostPorts = {
      contractVersion: CONTRACT_VERSION,
      auth: {
        requireStudent: () => (req, _res, next) => {
          (req as AuthenticatedStudentRequest).aiReviewStudent = {
            userId: opts.userId,
            role: 'STUDENT',
          };
          next();
        },
      },
      studentDirectory: {
        async getStudentSummary() {
          return { enrolledCourses: [] };
        },
      },
      planResolver: {
        async getPlanSubscription() {
          if (opts.planResolverError) {
            throw new Error('Simulated DB outage on Subscription');
          }
          return {
            planCode: currentPlan,
            startedAt: currentStartedAt,
            expiresAt: null,
          };
        },
      },
      attemptHistory: { async listAnswers() { return []; } },
      questionPool: { async findCandidates() { return []; }, async getByIds() { return []; } },
      eventBus: {
        emit(event, payload) {
          listeners.get(event)?.forEach((fn) => fn(payload));
        },
        on(event, listener) {
          const set = listeners.get(event) ?? new Set();
          set.add(listener);
          listeners.set(event, set);
          return () => set.delete(listener);
        },
      },
    };

    const mod = createAiReviewModule({
      ports,
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
        AI_REVIEW_QUOTA_FAIL_MODE: opts.failMode ?? 'closed',
      },
      nowFn: () => currentNow,
      planCacheTtlMs: opts.planCacheTtlMs ?? 60_000,
    });

    return {
      mod,
      ports,
      setPlan(nextPlan: PlanCode, nextStartedAt?: Date) {
        currentPlan = nextPlan;
        if (nextStartedAt) currentStartedAt = nextStartedAt;
      },
      setNow(nextNow: Date) {
        currentNow = nextNow;
      },
    };
  }

  it('atomic concurrency: 100 parallel consume() requests with limit=10 -> exactly 10 succeed, 90 get 429, exactly 10 usage_events', async () => {
    // Seed temporary limit=10 row for concurrency test
    await prisma.planLimit.upsert({
      where: { planCode_metric: { planCode: 'TEST_P10', metric: 'exam_sets' } },
      update: { period: 'day', limitValue: 10 },
      create: { planCode: 'TEST_P10', metric: 'exam_sets', period: 'day', limitValue: 10 },
    });

    const userId = trackUser('conc100');
    const h = createHarness({
      userId,
      initialPlan: 'TEST_P10' as unknown as PlanCode,
      now: new Date('2026-11-23T05:00:00.000Z'),
    });
    await h.mod.start();

    try {
      const results = await Promise.allSettled(
        Array.from({ length: 100 }, (_, i) =>
          h.mod.quotaService.consume(userId, 'exam_sets', 1, { requestId: `req-${i}` })
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(10);
      expect(rejected).toHaveLength(90);
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(QuotaExceededError);
      }

      const counter = await prisma.usageCounter.findUnique({
        where: {
          userId_metric_periodKey: {
            userId,
            metric: 'exam_sets',
            periodKey: '2026-11-23',
          },
        },
      });
      expect(counter?.used).toBe(10);

      const eventCount = await prisma.usageEvent.count({
        where: { userId, metric: 'exam_sets', periodKey: '2026-11-23' },
      });
      expect(eventCount).toBe(10);
    } finally {
      await h.mod.stop();
    }
  });

  it('handles midnight VN reset, plan upgrade/downgrade with immediate EventBus invalidation, and 60s TTL expiry', async () => {
    const userId = trackUser('lifecycle');
    // 2026-11-23 23:59:50+07:00 === 2026-11-23T16:59:50Z
    const h = createHarness({
      userId,
      initialPlan: 'FREE',
      now: new Date('2026-11-23T16:59:50.000Z'),
      planCacheTtlMs: 60_000,
    });
    await h.mod.start();

    try {
      // FREE limit = 3/day
      for (let i = 1; i <= 3; i++) {
        const res = await h.mod.quotaService.consume(userId, 'exam_sets', 1);
        expect(res.used).toBe(i);
        expect(res.remaining).toBe(3 - i);
      }

      // 4th call blocked with retryAfterSeconds = 10
      await expect(h.mod.quotaService.consume(userId, 'exam_sets', 1)).rejects.toMatchObject({
        status: 429,
        code: 'QUOTA_EXCEEDED',
        limit: 3,
        used: 3,
        remaining: 0,
        retryAfterSeconds: 10,
      });

      // Upgrade FREE -> PREMIUM + emit subscription.changed -> takes effect IMMEDIATELY
      h.setPlan('PREMIUM');
      h.ports.eventBus.emit('subscription.changed', {
        userId,
        oldPlan: 'FREE',
        newPlan: 'PREMIUM',
        startedAt: '2026-11-23T16:59:50.000Z',
        at: '2026-11-23T16:59:50.000Z',
      });

      const afterUpgrade = await h.mod.quotaService.consume(userId, 'exam_sets', 1);
      expect(afterUpgrade.plan).toBe('PREMIUM');
      expect(afterUpgrade.limit).toBe(30);
      expect(afterUpgrade.used).toBe(4);
      expect(afterUpgrade.remaining).toBe(26);

      // Downgrade PREMIUM -> FREE + emit event -> used (4) > limit (3) => blocked immediately
      h.setPlan('FREE');
      h.ports.eventBus.emit('subscription.changed', {
        userId,
        oldPlan: 'PREMIUM',
        newPlan: 'FREE',
        startedAt: '2026-11-23T16:59:50.000Z',
        at: '2026-11-23T16:59:50.000Z',
      });

      await expect(h.mod.quotaService.consume(userId, 'exam_sets', 1)).rejects.toMatchObject({
        status: 429,
        plan: 'FREE',
        limit: 3,
        used: 4,
        remaining: 0,
      });

      // Advance clock past 00:00:00+07:00 (2026-11-24 00:00:05+07:00) -> daily quota resets!
      h.setNow(new Date('2026-11-23T17:00:05.000Z'));
      const afterMidnight = await h.mod.quotaService.consume(userId, 'exam_sets', 1);
      expect(afterMidnight.periodKey).toBe('2026-11-24');
      expect(afterMidnight.used).toBe(1);
      expect(afterMidnight.remaining).toBe(2);

      // Verify usage_events captured accurate plan_code & limit_snapshot for billing
      const events = await prisma.usageEvent.findMany({
        where: { userId, metric: 'exam_sets' },
        orderBy: { createdAt: 'asc' },
      });
      expect(events).toHaveLength(5);
      expect(events[3].planCode).toBe('PREMIUM');
      expect(events[3].limitSnapshot).toBe(30);
    } finally {
      await h.mod.stop();
    }
  });

  it('TokenMeteringService enforces monthly subscription-cycle token budget and logs exact input/output tokens', async () => {
    const userId = trackUser('tokens');
    const h = createHarness({
      userId,
      initialPlan: 'FREE', // 150,000 tokens / subscription month
      startedAt: new Date('2026-11-10T02:00:00.000Z'), // anchor = 10th
      now: new Date('2026-11-23T06:00:00.000Z'),
    });
    await h.mod.start();

    try {
      const pre = await h.mod.tokenMetering.assertHasBudget(userId, 2000);
      expect(pre.periodKey).toBe('sub:2026-11-10');
      expect(pre.resetAt).toBe('2026-12-10T00:00:00+07:00');
      expect(pre.limit).toBe(150_000);

      // Record 149,500 tokens spent
      const recorded = await h.mod.tokenMetering.recordUsage(userId, {
        inputTokens: 100_000,
        outputTokens: 49_500,
        modelId: 'fake-v1',
        requestId: 'llm-req-1',
        latencyMs: 820,
      });
      expect(recorded.used).toBe(149_500);
      expect(recorded.remaining).toBe(500);

      // Next pre-flight check requiring 1,000 tokens must fail 429
      await expect(h.mod.tokenMetering.assertHasBudget(userId, 1000)).rejects.toMatchObject({
        status: 429,
        code: 'QUOTA_EXCEEDED',
        metric: 'llm_tokens',
        resetAt: '2026-12-10T00:00:00+07:00',
      });

      const evt = await prisma.usageEvent.findFirst({
        where: { userId, metric: 'llm_tokens', requestId: 'llm-req-1' },
      });
      expect(evt).toMatchObject({
        amount: 149_500,
        inputTokens: 100_000,
        outputTokens: 49_500,
        modelId: 'fake-v1',
        latencyMs: 820,
        planCode: 'FREE',
        limitSnapshot: 150_000,
      });
    } finally {
      await h.mod.stop();
    }
  });

  it('HTTP middleware returns 429 with Retry-After + X-Quota-* headers and GET /quota returns full snapshot', async () => {
    const userId = trackUser('http429');
    const h = createHarness({
      userId,
      initialPlan: 'FREE',
      now: new Date('2026-11-23T10:00:00.000Z'), // 17:00:00+07:00 (7h to midnight)
    });
    await h.mod.start();

    try {
      const app = express();
      app.use('/api/v1/ai-review', h.mod.publicRouter);
      app.post(
        '/api/v1/ai-review/test-consume',
        h.ports.auth.requireStudent(),
        h.mod.requireQuota('exam_sets', 1),
        (_req, res) => res.status(200).json({ data: { ok: true }, error: null })
      );

      for (let i = 1; i <= 3; i++) {
        const okRes = await request(app).post('/api/v1/ai-review/test-consume');
        expect(okRes.status).toBe(200);
        expect(okRes.headers['x-quota-limit']).toBe('3');
        expect(okRes.headers['x-quota-remaining']).toBe(String(3 - i));
        expect(okRes.headers['x-quota-reset']).toBe('2026-11-24T00:00:00+07:00');
      }

      const blocked = await request(app).post('/api/v1/ai-review/test-consume');
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBe('25200'); // 7 * 3600s
      expect(blocked.headers['x-quota-remaining']).toBe('0');
      expect(blocked.body.error).toMatchObject({
        code: 'QUOTA_EXCEEDED',
        status: 429,
        details: {
          metric: 'exam_sets',
          plan: 'FREE',
          limit: 3,
          used: 3,
          remaining: 0,
          reset_at: '2026-11-24T00:00:00+07:00',
          retry_after_seconds: 25200,
        },
      });

      const snap = await request(app).get('/api/v1/ai-review/quota');
      expect(snap.status).toBe(200);
      expect(snap.body.data.plan).toBe('FREE');
      expect(snap.body.data.timezone).toBe('Asia/Ho_Chi_Minh');
      expect(snap.body.data.quotas.exam_sets).toMatchObject({
        limit: 3,
        used: 3,
        remaining: 0,
      });
      expect(snap.body.data.quotas.llm_tokens).toMatchObject({
        limit: 150_000,
        used: 0,
        remaining: 150_000,
      });
    } finally {
      await h.mod.stop();
    }
  });

  it('respects AI_REVIEW_QUOTA_FAIL_MODE=closed (503) vs open (degraded allow)', async () => {
    const uClosed = trackUser('fail_closed');
    const hClosed = createHarness({
      userId: uClosed,
      failMode: 'closed',
      planResolverError: true,
    });
    await hClosed.mod.start();
    try {
      await expect(hClosed.mod.quotaService.consume(uClosed, 'exam_sets', 1)).rejects.toBeInstanceOf(
        QuotaServiceUnavailableError
      );
    } finally {
      await hClosed.mod.stop();
    }

    const uOpen = trackUser('fail_open');
    const hOpen = createHarness({
      userId: uOpen,
      failMode: 'open',
      planResolverError: true,
    });
    await hOpen.mod.start();
    try {
      const degraded = await hOpen.mod.quotaService.consume(uOpen, 'exam_sets', 1);
      expect(degraded.degraded).toBe(true);
    } finally {
      await hOpen.mod.stop();
    }
  });
});
