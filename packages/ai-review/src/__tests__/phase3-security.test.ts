import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@ai-review/prisma-client';
import {
  AiTokenError,
  CONTRACT_VERSION,
  createAiReviewModule,
  mintAiToken,
  sanitizeAuditMeta,
  validateExamSetCreatePayload,
  verifyAiToken,
  type AiReviewHostPorts,
  type AuthenticatedStudentRequest,
} from '../index.js';

const TEST_AI_REVIEW_DB_URL =
  process.env.AI_REVIEW_DATABASE_URL ||
  'postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=10';

describe('Phase 3 — Bảo mật API, JSON Schema (Ajv), Idempotency-Key, Rate Limit, Audit & PII Minimization', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_AI_REVIEW_DB_URL } },
  });
  const testPrefix = `p3_sec_${Date.now()}`;
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
      await prisma.auditEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.idempotencyKey.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.usageEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.usageCounter.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  describe('JSON Schema Draft 2020-12 strict validation (exam-set-create.v1)', () => {
    it('accepts valid payload and populates defaults (num_questions=20, difficulty=adaptive, exclude_recent_days=7)', () => {
      const res = validateExamSetCreatePayload({
        goal: 'Ôn tập CSDL và Hệ điều hành cuối kỳ',
        topics: ['CSDL', 'HDH'],
      });
      expect(res.valid).toBe(true);
      expect(res.data).toMatchObject({
        goal: 'Ôn tập CSDL và Hệ điều hành cuối kỳ',
        topics: ['CSDL', 'HDH'],
        num_questions: 20,
        difficulty: 'adaptive',
        exclude_recent_days: 7,
      });
    });

    it('rejects unknown fields (additionalProperties:false), type coercion, duplicates, and invalid patterns', () => {
      const extraField = validateExamSetCreatePayload({
        goal: 'Ôn CTDL',
        injectedAdminFlag: true,
      });
      expect(extraField.valid).toBe(false);
      expect(extraField.errors?.some((e) => e.keyword === 'additionalProperties')).toBe(true);

      const wrongType = validateExamSetCreatePayload({
        goal: 'Ôn CTDL',
        num_questions: '20', // no silent coercion
      });
      expect(wrongType.valid).toBe(false);

      const dupIds = validateExamSetCreatePayload({
        goal: 'Ôn CTDL',
        exam_ids: ['q-ctdl-1', 'q-ctdl-1'],
      });
      expect(dupIds.valid).toBe(false);

      const badTopic = validateExamSetCreatePayload({
        goal: 'Ôn CTDL',
        topics: ['HACKING'],
      });
      expect(badTopic.valid).toBe(false);
    });
  });

  describe('Short-lived Scoped AI Token (HS256, separate secret, aud/scope/exp)', () => {
    const aiSecret = 'ai_review_dedicated_token_secret_at_least_32_chars_long';
    const coreUserJwtSecret = 'super_secret_jwt_access_key_change_in_production_12345';

    it('mints and verifies valid scoped AI token, and rejects user JWT, wrong scope, expired token, and TTL > 300s', () => {
      expect(() =>
        mintAiToken({ userId: 'u1', scopes: ['student:read'], secret: aiSecret, ttlSec: 600 })
      ).toThrow(/300/);

      const minted = mintAiToken({
        userId: 'stu-123',
        scopes: ['student:read', 'attempts:read'],
        secret: aiSecret,
        ttlSec: 120,
      });
      const claims = verifyAiToken(minted.token, {
        secret: aiSecret,
        requiredScope: 'student:read',
      });
      expect(claims.sub).toBe('stu-123');
      expect(claims.jti).toBe(minted.jti);

      // Missing required scope -> 403 INSUFFICIENT_SCOPE
      try {
        verifyAiToken(minted.token, { secret: aiSecret, requiredScope: 'examset:create' });
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AiTokenError);
        expect((err as AiTokenError).status).toBe(403);
        expect((err as AiTokenError).code).toBe('INSUFFICIENT_SCOPE');
      }

      // Standard core user JWT -> 401 INVALID_AI_TOKEN
      const regularUserJwt = jwt.sign(
        { userId: 'stu-123', role: 'STUDENT', plan: 'PREMIUM' },
        coreUserJwtSecret,
        { expiresIn: '15m' }
      );
      try {
        verifyAiToken(regularUserJwt, { secret: aiSecret, requiredScope: 'student:read' });
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AiTokenError);
        expect((err as AiTokenError).status).toBe(401);
        expect((err as AiTokenError).code).toBe('INVALID_AI_TOKEN');
      }

      // Expired AI token -> 401 AI_TOKEN_EXPIRED
      const expiredToken = jwt.sign(
        { scope: ['student:read'] },
        aiSecret,
        {
          algorithm: 'HS256',
          issuer: 'devstudy-ai-review',
          audience: 'ai-review-internal',
          subject: 'stu-123',
          jwtid: crypto.randomUUID(),
          expiresIn: -5,
        }
      );
      try {
        verifyAiToken(expiredToken, { secret: aiSecret, requiredScope: 'student:read' });
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AiTokenError);
        expect((err as AiTokenError).status).toBe(401);
        expect((err as AiTokenError).code).toBe('AI_TOKEN_EXPIRED');
      }
    });
  });

  function createHarness(opts: {
    userId: string;
    rateLimitMax?: number;
    now?: Date;
  }) {
    let currentNow = opts.now ?? new Date('2026-11-23T10:00:00.000Z');
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
          return {
            selfLevel: 'TRUNG_BINH',
            enrolledCourses: [{ slug: 'fullstack-web', progress: 40 }],
          };
        },
      },
      planResolver: {
        async getPlanSubscription() {
          return {
            planCode: 'FREE',
            startedAt: new Date('2026-11-01T00:00:00.000Z'),
            expiresAt: null,
          };
        },
      },
      attemptHistory: {
        async listAnswers() {
          return [
            {
              questionId: 'q-csdl-3',
              topic: 'CSDL',
              difficulty: 'MEDIUM',
              isCorrect: false,
              timeSpentMs: 73_000,
              answeredAt: new Date('2026-11-20T09:15:30.000Z'),
            },
            {
              questionId: 'q-csdl-1',
              topic: 'CSDL',
              difficulty: 'EASY',
              isCorrect: true,
              timeSpentMs: 29_000,
              answeredAt: new Date('2026-11-21T11:00:00.000Z'),
            },
          ];
        },
      },
      questionPool: {
        async findCandidates() { return []; },
        async getByIds() { return []; },
      },
      eventBus: {
        emit() {},
        on() { return () => {}; },
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
        AI_REVIEW_RATE_LIMIT_MAX: String(opts.rateLimitMax ?? 30),
        AI_REVIEW_RATE_LIMIT_WINDOW_SEC: '60',
      },
      nowFn: () => currentNow,
    });

    return {
      mod,
      setNow(next: Date) {
        currentNow = next;
      },
    };
  }

  it('AuditService strips PII/tokens and redacts embedded JWTs/emails before writing to DB', async () => {
    const userId = trackUser('audit_hygiene');
    const h = createHarness({ userId });
    await h.mod.start();

    try {
      const cleaned = sanitizeAuditMeta({
        email: 'student@edu.vn',
        token: 'eyJhbGciOiJIUzI1NiJ9.payload1234.signature123',
        authorization: 'Bearer topsecret',
        studentId: '20210002',
        note: 'Leak attempt student@edu.vn and eyJhbGciOiJIUzI1NiJ9.abcdefgh.ijklmnop',
        safeCount: 20,
      });

      const serializedClean = JSON.stringify(cleaned);
      expect(serializedClean).toContain('"safeCount":20');
      expect(serializedClean).not.toContain('student@edu.vn');
      expect(serializedClean).not.toContain('eyJhbGci');
      expect(serializedClean).not.toContain('20210002');
      expect(serializedClean).not.toContain('topsecret');

      await h.mod.auditService.record({
        actorType: 'student',
        userId,
        action: 'test.hygiene',
        resource: 'exam_set',
        outcome: 'ALLOW',
        meta: {
          email: 'linh.tt@edu.vn',
          apiKey: 'AIzaSecret',
          requested: 20,
        },
      });

      const logs = await h.mod.auditService.listByUser(userId, 5);
      expect(logs).toHaveLength(1);
      const dbJson = JSON.stringify(logs[0]);
      expect(dbJson).toContain('"requested":20');
      expect(dbJson).not.toContain('linh.tt@edu.vn');
      expect(dbJson).not.toContain('AIzaSecret');
    } finally {
      await h.mod.stop();
    }
  });

  it('minimizes PII on /me/profile & /me/attempts and blocks student_id query tampering with 403 + DENY audit', async () => {
    const userId = trackUser('pii_read');
    const h = createHarness({ userId });
    await h.mod.start();

    try {
      const app = express();
      app.use('/api/v1/ai-review', h.mod.publicRouter);

      const profRes = await request(app).get('/api/v1/ai-review/me/profile');
      expect(profRes.status).toBe(200);
      expect(profRes.body.data).toEqual({
        alias: 'Học viên',
        role: 'STUDENT',
        plan: 'FREE',
        self_level: 'TRUNG_BINH',
        enrolled_courses: [{ slug: 'fullstack-web', progress: 40 }],
      });

      const attRes = await request(app).get('/api/v1/ai-review/me/attempts?topic=CSDL&limit=50');
      expect(attRes.status).toBe(200);
      expect(attRes.body.data.summary).toEqual([
        { topic: 'CSDL', answered: 2, accuracy: 0.5, avg_time_s: 51 },
      ]);
      expect(attRes.body.data.items[0]).toEqual({
        question_id: 'q-csdl-3',
        topic: 'CSDL',
        difficulty: 'medium',
        correct: false,
        time_spent_s: 73,
        answered_on: '2026-11-20',
      });

      // Attempt to read another student's data via query param -> 403 + DENY audit
      const tamperRes = await request(app).get('/api/v1/ai-review/me/attempts?student_id=victim_user_99');
      expect(tamperRes.status).toBe(403);
      expect(tamperRes.body.error.code).toBe('FORBIDDEN_STUDENT_OVERRIDE');

      const audits = await h.mod.auditService.listByUser(userId, 10);
      const actions = audits.map((a) => `${a.action}:${a.outcome}`);
      expect(actions).toContain('student_profile.read:ALLOW');
      expect(actions).toContain('attempt_history.read:ALLOW');
      expect(actions).toContain('security.student_override_blocked:DENY');
    } finally {
      await h.mod.stop();
    }
  });

  it('createExamSetGuardStack enforces Schema, Idempotency replay (no double quota), 409 conflict, TTL expiry, and anti-override', async () => {
    const userId = trackUser('guard_stack');
    const h = createHarness({ userId, now: new Date('2026-11-23T10:00:00.000Z') });
    await h.mod.start();

    try {
      let handlerCalls = 0;
      const app = express();
      app.use(express.json());
      app.post(
        '/api/v1/ai-review/test-exam-sets',
        ...h.mod.createExamSetGuardStack(),
        (req, res) => {
          handlerCalls += 1;
          return res.status(201).json({
            data: {
              exam_set_id: `es_${handlerCalls}`,
              num_questions: req.body.num_questions,
              difficulty: req.body.difficulty,
            },
            error: null,
          });
        }
      );

      // 1. Missing Idempotency-Key -> 400
      const noKey = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .send({ goal: 'Ôn thi CSDL cuối kỳ' });
      expect(noKey.status).toBe(400);
      expect(noKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

      // 2. Non-UUID Idempotency-Key -> 400
      const badKey = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', 'not-a-uuid')
        .send({ goal: 'Ôn thi CSDL cuối kỳ' });
      expect(badKey.status).toBe(400);
      expect(badKey.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY');

      // 3. Mismatched student_id in body -> 403 + DENY audit, NO quota consumed
      const k1 = crypto.randomUUID();
      const spoofed = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', k1)
        .send({ student_id: 'other_student_id_999', goal: 'Ôn thi CSDL' });
      expect(spoofed.status).toBe(403);
      expect(spoofed.body.error.code).toBe('FORBIDDEN_STUDENT_OVERRIDE');

      // 4. Schema invalid (extra property) -> 400 SCHEMA_VALIDATION_ERROR, NO quota consumed
      const badSchema = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', k1)
        .send({ goal: 'Ôn thi CSDL', unknownField: 123 });
      expect(badSchema.status).toBe(400);
      expect(badSchema.body.error.code).toBe('SCHEMA_VALIDATION_ERROR');

      // 5. Valid creation -> 201 (defaults applied: 20 questions, adaptive)
      const created = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', k1)
        .send({ goal: 'Ôn thi CSDL', topics: ['CSDL'] });
      expect(created.status).toBe(201);
      expect(created.body.data).toEqual({
        exam_set_id: 'es_1',
        num_questions: 20,
        difficulty: 'adaptive',
      });
      expect(handlerCalls).toBe(1);

      // 6. Replay with SAME key & SAME body (different key order) -> 201 + Idempotent-Replayed: true, NO second quota hit!
      const replayed = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', k1)
        .send({ topics: ['CSDL'], goal: 'Ôn thi CSDL' });
      expect(replayed.status).toBe(201);
      expect(replayed.headers['idempotent-replayed']).toBe('true');
      expect(replayed.body.data).toEqual({
        exam_set_id: 'es_1',
        num_questions: 20,
        difficulty: 'adaptive',
      });
      expect(handlerCalls).toBe(1);

      const quotaStatus = await h.mod.quotaService.getMetricStatus(userId, 'exam_sets');
      expect(quotaStatus.used).toBe(1); // Đảm bảo không trừ quota 2 lần!

      // 7. Same key with DIFFERENT payload -> 409 IDEMPOTENCY_KEY_CONFLICT + DENY audit
      const conflict = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', k1)
        .send({ goal: 'Mục tiêu khác hoàn toàn', topics: ['CTDL'] });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

      // 8. Exhaust remaining 2 FREE quota slots, then verify 429 releases the idempotency lock (does not poison key)
      await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ goal: 'Đề ôn 2' })
        .expect(201);
      await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ goal: 'Đề ôn 3' })
        .expect(201);

      const kBlocked = crypto.randomUUID();
      const blocked429 = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', kBlocked)
        .send({ goal: 'Đề ôn 4 bị chặn' });
      expect(blocked429.status).toBe(429);

      // Lock for kBlocked must have been released so after next-day reset it succeeds cleanly!
      h.setNow(new Date('2026-11-24T11:00:00.000Z')); // +25h (past both VN midnight and 24h TTL)
      const retriedNextDay = await request(app)
        .post('/api/v1/ai-review/test-exam-sets')
        .set('Idempotency-Key', kBlocked)
        .send({ goal: 'Đề ôn 4 bị chặn' });
      expect(retriedNextDay.status).toBe(201);
      expect(retriedNextDay.headers['idempotent-replayed']).toBeUndefined();
    } finally {
      await h.mod.stop();
    }
  });

  it('enforces per-user rate limit with 429 RATE_LIMIT_EXCEEDED + Retry-After + audit DENY', async () => {
    const userId = trackUser('ratelimit');
    const h = createHarness({ userId, rateLimitMax: 3 });
    await h.mod.start();

    try {
      const app = express();
      app.use('/api/v1/ai-review', h.mod.publicRouter);

      for (let i = 0; i < 3; i++) {
        const ok = await request(app).get('/api/v1/ai-review/me/profile');
        expect(ok.status).toBe(200);
        expect(ok.headers['x-ratelimit-limit']).toBe('3');
      }

      const limited = await request(app).get('/api/v1/ai-review/me/profile');
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

      const audits = await h.mod.auditService.listByUser(userId, 10);
      expect(audits.some((a) => a.action === 'security.rate_limit_exceeded' && a.outcome === 'DENY')).toBe(true);
    } finally {
      await h.mod.stop();
    }
  });
});
