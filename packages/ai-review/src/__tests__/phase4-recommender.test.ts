import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@ai-review/prisma-client';
import {
  ALL_TOPICS,
  CONTRACT_VERSION,
  MASTERY_DECAY_LAMBDA,
  MASTERY_PRIOR_ALPHA,
  MASTERY_PRIOR_P0,
  allocateQuestionSlots,
  computeSpacedReviewCandidates,
  computeTopicMasteries,
  createAiReviewModule,
  largestRemainderAllocate,
  selectDeterministicQuestions,
  type AiReviewHostPorts,
  type AttemptAnswerRecord,
  type AuthenticatedStudentRequest,
  type PlayableQuestion,
  type QuestionCandidate,
  type TopicCode,
} from '../index.js';

const TEST_AI_REVIEW_DB_URL =
  process.env.AI_REVIEW_DATABASE_URL ||
  'postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=10';

function buildFixturePool(perTopic: number = 10): PlayableQuestion[] {
  const diffs: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];
  const levels: Array<'CO_BAN' | 'TRUNG_BINH' | 'NANG_CAO'> = ['CO_BAN', 'TRUNG_BINH', 'NANG_CAO'];
  const out: PlayableQuestion[] = [];
  for (const topic of ALL_TOPICS) {
    for (let i = 1; i <= perTopic; i++) {
      const d = diffs[(i - 1) % 3];
      const l = levels[(i - 1) % 3];
      out.push({
        id: `q-${topic.toLowerCase()}-${i}`,
        topic,
        level: l,
        type: 'MCQ',
        difficulty: d,
        tags: [topic.toLowerCase()],
        estimatedTimeSec: 45,
        prompt: `Câu hỏi ${i} của chủ đề ${topic}`,
        code: null,
        options: ['A', 'B', 'C', 'D'],
      });
    }
  }
  return out;
}

describe('Phase 4 — Recommender, Mastery, 20-Q ExamSet Builder & Deterministic Fallback', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_AI_REVIEW_DB_URL } },
  });
  const testPrefix = `p4_rec_${Date.now()}`;
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
      await prisma.examSet.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.idempotencyKey.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.usageEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.usageCounter.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  describe('Mastery & Weakness Formula (deterministic numeric verification)', () => {
    it('computes exact Bayesian time-decayed, difficulty-weighted mastery with slow-answer penalty', () => {
      const now = new Date('2026-11-23T12:00:00.000Z');
      const dayMs = 86_400_000;

      const answers: AttemptAnswerRecord[] = [
        // CSDL: 1 wrong EASY today (w=1, d=1.2, c=0) + 1 slow correct MEDIUM 14d ago (w=0.5, d=1.0, c=0.5)
        {
          questionId: 'q-csdl-1',
          topic: 'CSDL',
          difficulty: 'EASY',
          isCorrect: false,
          timeSpentMs: 30_000,
          answeredAt: now,
        },
        {
          questionId: 'q-csdl-2',
          topic: 'CSDL',
          difficulty: 'MEDIUM',
          isCorrect: true,
          timeSpentMs: 120_000, // > 2 * 45_000 => slow credit = 0.5
          answeredAt: new Date(now.getTime() - 14 * dayMs),
        },
        // CTDL: 2 fast correct HARD today (w=1, d=1.2, c=1.0 each)
        {
          questionId: 'q-ctdl-1',
          topic: 'CTDL',
          difficulty: 'HARD',
          isCorrect: true,
          timeSpentMs: 30_000,
          answeredAt: now,
        },
        {
          questionId: 'q-ctdl-2',
          topic: 'CTDL',
          difficulty: 'HARD',
          isCorrect: true,
          timeSpentMs: 35_000,
          answeredAt: now,
        },
      ];

      const masteries = computeTopicMasteries(answers, now);
      const csdl = masteries.find((m) => m.topic === 'CSDL')!;
      const ctdl = masteries.find((m) => m.topic === 'CTDL')!;
      const oop = masteries.find((m) => m.topic === 'OOP')!;

      // Hand calculation for CSDL:
      // w1 = 1, d1 = 1.2, c1 = 0
      // w2 = exp(-ln(2)/14 * 14) = 0.5, d2 = 1.0, c2 = 0.5
      // num = 0 + 0.25 + 2*0.6 = 1.45; den = 1.2 + 0.5 + 2 = 3.7 => 1.45 / 3.7 = 0.39189...
      const expectedCsdl =
        (0 + Math.exp(-MASTERY_DECAY_LAMBDA * 14) * 1.0 * 0.5 + MASTERY_PRIOR_ALPHA * MASTERY_PRIOR_P0) /
        (1.2 + Math.exp(-MASTERY_DECAY_LAMBDA * 14) * 1.0 + MASTERY_PRIOR_ALPHA);
      expect(csdl.mastery).toBeCloseTo(expectedCsdl, 4);
      expect(csdl.isWeak).toBe(true);
      expect(csdl.recommendedDifficulty).toBe('EASY');

      // Hand calculation for CTDL:
      // num = 2 * 1.2 + 1.2 = 3.6; den = 2 * 1.2 + 2 = 4.4 => 3.6 / 4.4 = 0.8182
      expect(ctdl.mastery).toBeCloseTo(3.6 / 4.4, 4);
      expect(ctdl.isWeak).toBe(false);
      expect(ctdl.recommendedDifficulty).toBe('HARD');

      // Untouched topic OOP -> cold-start neutral exploration
      expect(oop).toMatchObject({
        mastery: 0.5,
        weakness: 0.5,
        confidence: 0,
        confidenceLabel: 'none',
        isWeak: false,
      });
    });

    it('identifies spaced-review candidates only when latest attempt is wrong and >= 3 days old', () => {
      const now = new Date('2026-11-23T12:00:00.000Z');
      const dayMs = 86_400_000;

      const answers: AttemptAnswerRecord[] = [
        // Wrong 5 days ago -> ELIGIBLE
        {
          questionId: 'q-csdl-1',
          topic: 'CSDL',
          difficulty: 'MEDIUM',
          isCorrect: false,
          timeSpentMs: 40_000,
          answeredAt: new Date(now.getTime() - 5 * dayMs),
        },
        // Wrong 1 day ago -> TOO RECENT (< 3d)
        {
          questionId: 'q-csdl-2',
          topic: 'CSDL',
          difficulty: 'MEDIUM',
          isCorrect: false,
          timeSpentMs: 40_000,
          answeredAt: new Date(now.getTime() - 1 * dayMs),
        },
        // Wrong 10 days ago, then CORRECT 2 days ago -> MASTERED (not eligible)
        {
          questionId: 'q-csdl-3',
          topic: 'CSDL',
          difficulty: 'MEDIUM',
          isCorrect: false,
          timeSpentMs: 40_000,
          answeredAt: new Date(now.getTime() - 10 * dayMs),
        },
        {
          questionId: 'q-csdl-3',
          topic: 'CSDL',
          difficulty: 'MEDIUM',
          isCorrect: true,
          timeSpentMs: 30_000,
          answeredAt: new Date(now.getTime() - 2 * dayMs),
        },
      ];

      const spaced = computeSpacedReviewCandidates(answers, now);
      expect(spaced.map((s) => s.questionId)).toEqual(['q-csdl-1']);
    });
  });

  describe('Slot Allocation & Deterministic Selection', () => {
    it('largestRemainderAllocate sums exactly to requested total and respects explicit topics', () => {
      const alloc = largestRemainderAllocate(
        [
          { key: 'CSDL', weight: 0.61 },
          { key: 'HDH', weight: 0.55 },
          { key: 'MANG', weight: 0.34 },
        ],
        20
      );
      const sum = [...alloc.values()].reduce((a, b) => a + b, 0);
      expect(sum).toBe(20);

      const masteries = computeTopicMasteries([], new Date('2026-11-23T12:00:00.000Z'));
      const plan = allocateQuestionSlots({
        requested: 20,
        masteries,
        explicitTopics: ['CSDL', 'HDH'],
        spacedReviewAvailable: 2,
      });
      const totalSlots =
        plan.spacedReviewSlots +
        [...plan.weakTopicSlots.values()].reduce((a, b) => a + b, 0) +
        [...plan.explorationSlots.values()].reduce((a, b) => a + b, 0);
      expect(totalSlots).toBe(20);
      expect([...plan.weakTopicSlots.keys()].every((t) => t === 'CSDL' || t === 'HDH')).toBe(true);
    });

    it('is 100% deterministic, excludes recent 7-day questions (except spaced review), and never duplicates on small pools', () => {
      const now = new Date('2026-11-23T12:00:00.000Z');
      const dayMs = 86_400_000;
      const pool = buildFixturePool(10);

      const answers: AttemptAnswerRecord[] = [
        // Recently answered correctly (2 days ago) -> MUST be excluded
        {
          questionId: 'q-csdl-1',
          topic: 'CSDL',
          difficulty: 'EASY',
          isCorrect: true,
          timeSpentMs: 25_000,
          answeredAt: new Date(now.getTime() - 2 * dayMs),
        },
        // Wrong 5 days ago -> ELIGIBLE via SPACED_REVIEW even though < 7d
        {
          questionId: 'q-csdl-2',
          topic: 'CSDL',
          difficulty: 'MEDIUM',
          isCorrect: false,
          timeSpentMs: 70_000,
          answeredAt: new Date(now.getTime() - 5 * dayMs),
        },
      ];

      const masteries = computeTopicMasteries(answers, now);

      const run1 = selectDeterministicQuestions({
        userId: 'stu-det-1',
        dateKey: '2026-11-23',
        requested: 20,
        difficultyPreference: 'adaptive',
        excludeRecentDays: 7,
        now,
        answers,
        pool,
        masteries,
      });
      const run2 = selectDeterministicQuestions({
        userId: 'stu-det-1',
        dateKey: '2026-11-23',
        requested: 20,
        difficultyPreference: 'adaptive',
        excludeRecentDays: 7,
        now,
        answers,
        pool,
        masteries,
      });

      expect(run1.selected).toHaveLength(20);
      expect(run1.selected.map((s) => s.question.id)).toEqual(
        run2.selected.map((s) => s.question.id)
      );
      const ids = run1.selected.map((s) => s.question.id);
      expect(new Set(ids).size).toBe(20); // zero duplicates
      expect(ids).not.toContain('q-csdl-1'); // recent correct excluded
      expect(ids).toContain('q-csdl-2'); // wrong 5d ago included as SPACED_REVIEW
      expect(run1.selected.find((s) => s.question.id === 'q-csdl-2')?.reasonCode).toBe(
        'SPACED_REVIEW'
      );

      // Small pool (only 6 questions available, request 20) -> returns 6 unique + INSUFFICIENT_POOL warning
      const small = selectDeterministicQuestions({
        userId: 'stu-det-1',
        dateKey: '2026-11-23',
        requested: 20,
        difficultyPreference: 'adaptive',
        excludeRecentDays: 7,
        now,
        answers: [],
        pool: pool.slice(0, 6),
        masteries,
      });
      expect(small.selected).toHaveLength(6);
      expect(new Set(small.selected.map((s) => s.question.id)).size).toBe(6);
      expect(small.warnings).toContain('INSUFFICIENT_POOL');
    });
  });

  function createModuleHarness(opts: {
    userId: string;
    pool: PlayableQuestion[];
    answers: AttemptAnswerRecord[];
    now?: Date;
  }) {
    const currentNow = opts.now ?? new Date('2026-11-23T12:00:00.000Z');
    const listeners = new Map<string, Set<(p: any) => void>>();
    const emittedCreated: any[] = [];

    const poolMap = new Map(opts.pool.map((q) => [q.id, q]));

    const ports: AiReviewHostPorts = {
      contractVersion: CONTRACT_VERSION,
      auth: {
        requireStudent: () => (req, _res, next) => {
          const overrideHeader = req.headers['x-test-user'];
          (req as AuthenticatedStudentRequest).aiReviewStudent = {
            userId: typeof overrideHeader === 'string' ? overrideHeader : opts.userId,
            role: 'STUDENT',
          };
          next();
        },
      },
      studentDirectory: {
        async getStudentSummary() {
          return { selfLevel: 'TRUNG_BINH', enrolledCourses: [] };
        },
      },
      planResolver: {
        async getPlanSubscription() {
          return {
            planCode: 'PREMIUM',
            startedAt: new Date('2026-11-01T00:00:00.000Z'),
            expiresAt: null,
          };
        },
      },
      attemptHistory: {
        async listAnswers() {
          return opts.answers;
        },
      },
      questionPool: {
        async findCandidates(filter) {
          let list: QuestionCandidate[] = opts.pool;
          if (filter?.topics?.length) {
            const set = new Set<TopicCode>(filter.topics);
            list = list.filter((q) => set.has(q.topic));
          }
          return list.slice(0, filter?.limit ?? 500);
        },
        async getByIds(ids) {
          return ids
            .map((id) => poolMap.get(id))
            .filter((q): q is PlayableQuestion => Boolean(q));
        },
        async getPlayableByIds(ids) {
          return ids
            .map((id) => poolMap.get(id))
            .filter((q): q is PlayableQuestion => Boolean(q));
        },
      },
      eventBus: {
        emit(event, payload) {
          if (event === 'ai_review.exam_set.created') emittedCreated.push(payload);
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
      },
      nowFn: () => currentNow,
    });

    return { mod, ports, emittedCreated };
  }

  it('anti-hallucination builder handles llm, hybrid, threshold fallback, and LLM failure fallback cleanly', async () => {
    const userId = trackUser('builder');
    const now = new Date('2026-11-23T12:00:00.000Z');
    const pool = buildFixturePool(15); // 105 questions across 7 topics
    const answers: AttemptAnswerRecord[] = [
      // q-csdl-1 answered correctly yesterday -> RECENTLY_ATTEMPTED
      {
        questionId: 'q-csdl-1',
        topic: 'CSDL',
        difficulty: 'EASY',
        isCorrect: true,
        timeSpentMs: 25_000,
        answeredAt: new Date(now.getTime() - 86_400_000),
      },
    ];

    const h = createModuleHarness({ userId, pool, answers, now });
    await h.mod.start();

    try {
      // 1. HYBRID mode: 12 valid CSDL/HDH IDs (>= 50% of 20) + fake IDs + duplicate + recent + out-of-topic
      const hybridRes = await h.mod.recommenderService.createExamSet({
        userId,
        payload: {
          goal: 'Ôn CSDL và HDH',
          topics: ['CSDL', 'HDH'],
          num_questions: 20,
          difficulty: 'adaptive',
          exclude_recent_days: 7,
        },
        llmProposedIds: [
          'q-csdl-2', 'q-csdl-3', 'q-csdl-4', 'q-csdl-5', 'q-csdl-6', 'q-csdl-7',
          'q-hdh-1', 'q-hdh-2', 'q-hdh-3', 'q-hdh-4', 'q-hdh-5', 'q-hdh-6',
          'q-csdl-2',        // DUPLICATE
          'q-hallucinated-1', // NOT_FOUND
          'q-draft-secret',   // NOT_FOUND (not APPROVED)
          'q-csdl-1',        // RECENTLY_ATTEMPTED
          'q-ctdl-1',        // NOT_IN_POOL (topics restricted to CSDL, HDH)
        ],
      });

      expect(hybridRes.source).toBe('hybrid');
      expect(hybridRes.requested).toBe(20);
      expect(hybridRes.fulfilled).toBe(20);
      expect(hybridRes.filled_by_fallback).toBe(8);
      expect(hybridRes.rejected_ids).toEqual([
        { id: 'q-csdl-2', reason: 'DUPLICATE' },
        { id: 'q-hallucinated-1', reason: 'NOT_FOUND' },
        { id: 'q-draft-secret', reason: 'NOT_FOUND' },
        { id: 'q-csdl-1', reason: 'RECENTLY_ATTEMPTED' },
        { id: 'q-ctdl-1', reason: 'NOT_IN_POOL' },
      ]);
      const hybridIds = hybridRes.items.map((i) => i.question_id);
      expect(new Set(hybridIds).size).toBe(20);
      expect(hybridIds).not.toContain('q-csdl-1');
      expect(hybridIds).not.toContain('q-hallucinated-1');
      expect(hybridRes.items.every((i) => i.topic === 'CSDL' || i.topic === 'HDH')).toBe(true);

      // 2. BELOW 50% THRESHOLD -> full rule-based fallback
      const thresholdRes = await h.mod.recommenderService.createExamSet({
        userId,
        payload: {
          goal: 'Ôn tổng hợp',
          num_questions: 20,
          difficulty: 'medium',
          exclude_recent_days: 7,
        },
        llmProposedIds: ['q-ctdl-1', 'q-fake-1', 'q-fake-2', 'q-fake-3'],
      });
      expect(thresholdRes.source).toBe('rule_based');
      expect(thresholdRes.fulfilled).toBe(20);
      expect(thresholdRes.filled_by_fallback).toBe(20);
      expect(thresholdRes.warnings).toContain('PROPOSED_IDS_BELOW_THRESHOLD_FALLBACK');

      // 3. LLM FAILED -> full deterministic rule-based fallback
      const llmErrRes = await h.mod.recommenderService.createExamSet({
        userId,
        payload: {
          goal: 'Ôn khi LLM lỗi',
          num_questions: 20,
          difficulty: 'adaptive',
          exclude_recent_days: 7,
        },
        llmFailed: true,
      });
      expect(llmErrRes.source).toBe('rule_based');
      expect(llmErrRes.fulfilled).toBe(20);
      expect(llmErrRes.warnings).toContain('LLM_FALLBACK_ACTIVATED');

      // 4. PURE LLM mode (20 valid non-recent IDs)
      const pureIds = pool
        .filter((q) => q.id !== 'q-csdl-1')
        .slice(0, 20)
        .map((q) => q.id);
      const pureRes = await h.mod.recommenderService.createExamSet({
        userId,
        payload: {
          goal: 'Đề chuẩn 20 câu từ LLM',
          num_questions: 20,
          difficulty: 'adaptive',
          exclude_recent_days: 7,
        },
        llmProposedIds: pureIds,
      });
      expect(pureRes.source).toBe('llm');
      expect(pureRes.fulfilled).toBe(20);
      expect(pureRes.filled_by_fallback).toBe(0);
      expect(pureRes.rejected_ids).toEqual([]);

      // EventBus fired 4 times & DB persisted all 4 sets
      expect(h.emittedCreated).toHaveLength(4);
      const savedSets = await h.mod.recommenderService.listExamSets(userId, 10);
      expect(savedSets).toHaveLength(4);
    } finally {
      await h.mod.stop();
    }
  });

  it('HTTP endpoints: GET /recommendations (0 quota), POST /exam-sets (20-Q + Idempotency + Quota), GET /exam-sets/:id (anti-IDOR)', async () => {
    const userId = trackUser('http_e2e');
    const otherUserId = trackUser('http_other');
    const pool = buildFixturePool(10);
    const now = new Date('2026-11-23T12:00:00.000Z');
    const answers: AttemptAnswerRecord[] = [
      {
        questionId: 'q-hdh-1',
        topic: 'HDH',
        difficulty: 'EASY',
        isCorrect: false,
        timeSpentMs: 60_000,
        answeredAt: new Date(now.getTime() - 4 * 86_400_000),
      },
      {
        questionId: 'q-hdh-2',
        topic: 'HDH',
        difficulty: 'MEDIUM',
        isCorrect: false,
        timeSpentMs: 65_000,
        answeredAt: new Date(now.getTime() - 4 * 86_400_000),
      },
    ];

    const h = createModuleHarness({ userId, pool, answers, now });
    await h.mod.start();

    try {
      const app = express();
      app.use(express.json());
      app.use('/api/v1/ai-review', h.mod.publicRouter);

      // 1. GET /recommendations -> rule-based, HDH flagged weak, ZERO quota consumed
      const recRes = await request(app).get('/api/v1/ai-review/recommendations');
      expect(recRes.status).toBe(200);
      expect(recRes.body.data.source).toBe('rule_based');
      expect(recRes.body.data.weak_topics).toContain('HDH');
      expect(recRes.body.data.spaced_review_due_count).toBe(2);

      const quotaBefore = await h.mod.quotaService.getMetricStatus(userId, 'exam_sets');
      expect(quotaBefore.used).toBe(0);

      // 2. POST /exam-sets -> creates 20-question set + consumes 1 quota
      const idempKey = crypto.randomUUID();
      const postRes = await request(app)
        .post('/api/v1/ai-review/exam-sets')
        .set('Idempotency-Key', idempKey)
        .send({ goal: 'Luyện tập 20 câu khắc phục điểm yếu HDH' });

      expect(postRes.status).toBe(201);
      expect(postRes.body.data.requested).toBe(20);
      expect(postRes.body.data.fulfilled).toBe(20);
      expect(postRes.body.data.source).toBe('rule_based');
      expect(postRes.body.data.quota).toMatchObject({
        metric: 'exam_sets',
        limit: 30,
        remaining: 29,
      });
      const examSetId = postRes.body.data.exam_set_id;

      // 3. Replay POST /exam-sets with same Idempotency-Key -> cached 201, quota NOT double-charged
      const replayRes = await request(app)
        .post('/api/v1/ai-review/exam-sets')
        .set('Idempotency-Key', idempKey)
        .send({ goal: 'Luyện tập 20 câu khắc phục điểm yếu HDH' });
      expect(replayRes.status).toBe(201);
      expect(replayRes.headers['idempotent-replayed']).toBe('true');
      expect(replayRes.body.data.exam_set_id).toBe(examSetId);
      const quotaAfter = await h.mod.quotaService.getMetricStatus(userId, 'exam_sets');
      expect(quotaAfter.used).toBe(1);

      // 4. GET /exam-sets/:id -> owner gets playable 20 questions (NO correctIndex/explanation)
      const detailRes = await request(app).get(`/api/v1/ai-review/exam-sets/${examSetId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.items).toHaveLength(20);
      expect(detailRes.body.data.items[0]).toHaveProperty('prompt');
      expect(detailRes.body.data.items[0]).toHaveProperty('options');
      expect(detailRes.body.data.items[0]).not.toHaveProperty('correctIndex');
      expect(detailRes.body.data.items[0]).not.toHaveProperty('explanation');

      // 5. Anti-IDOR: another student gets 404 EXAM_SET_NOT_FOUND
      const otherRes = await request(app)
        .get(`/api/v1/ai-review/exam-sets/${examSetId}`)
        .set('x-test-user', otherUserId);
      expect(otherRes.status).toBe(404);
      expect(otherRes.body.error.code).toBe('EXAM_SET_NOT_FOUND');

      // 6. Emitting attempt.completed invalidates mastery cache cleanly
      h.ports.eventBus.emit('attempt.completed', {
        userId,
        attemptId: 'att-1',
        practiceSetId: examSetId,
        topic: 'HDH',
        totalQuestions: 20,
        correctCount: 16,
        score: 80,
        answeredAt: now.toISOString(),
      });
    } finally {
      await h.mod.stop();
    }
  });
});
