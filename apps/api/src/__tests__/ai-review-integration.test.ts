import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { QuestionStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../index.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import { coreEventBus } from '../events/bus.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { checkQuota } from '../middlewares/checkQuota.js';
import {
  createAiReviewHostPorts,
  mountAiReviewModule,
} from '../integrations/ai-review/index.js';

const TEST_AI_REVIEW_DB_URL =
  process.env.AI_REVIEW_DATABASE_URL ||
  'postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=5';

describe('Phase 1 — Host Integration for @devstudy/ai-review (Plug-and-Play)', () => {
  let studentPremiumToken = '';
  let studentExpiredToken = '';
  let lecturerToken = '';
  let studentLinhId = '';

  beforeAll(async () => {
    const login = async (email: string) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123' });
      expect(res.status).toBe(200);
      return res.body.data;
    };

    const linh = await login('linh.tt@edu.vn');
    studentPremiumToken = linh.accessToken;
    studentLinhId = linh.user.id;

    const trang = await login('trang.lt@edu.vn');
    studentExpiredToken = trang.accessToken;

    const bao = await login('bao.tq@hust.edu.vn');
    lecturerToken = bao.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('Feature flag OFF (mặc định): /api/v1/ai-review/status trả 404 và core hoạt động bình thường', async () => {
    const statusRes = await request(app).get('/api/v1/ai-review/status');
    expect(statusRes.status).toBe(404);

    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
  });

  it('Feature flag ON với fake provider: /status 200, /health 200, /me/context chỉ cho STUDENT và KHÔNG lộ PII', async () => {
    const testApp = express();
    testApp.use(express.json());

    const mod = await mountAiReviewModule(testApp, {
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
      },
    });
    expect(mod).not.toBeNull();

    try {
      // 1. Status & Health
      const statusRes = await request(testApp).get('/api/v1/ai-review/status');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.enabled).toBe(true);

      const healthRes = await request(testApp).get('/api/v1/ai-review/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.data.schema).toBe('ai_review');

      // 2. Guest -> 401
      const guestRes = await request(testApp).get('/api/v1/ai-review/me/context');
      expect(guestRes.status).toBe(401);

      // 3. LECTURER -> 403 (module chỉ dành cho STUDENT)
      const lecturerRes = await request(testApp)
        .get('/api/v1/ai-review/me/context')
        .set('Authorization', `Bearer ${lecturerToken}`);
      expect(lecturerRes.status).toBe(403);
      expect(lecturerRes.body.error.code).toBe('FORBIDDEN_ROLE');

      // 4. STUDENT PREMIUM -> 200, dữ liệu học tập ẩn danh (ZERO PII)
      const studentRes = await request(testApp)
        .get('/api/v1/ai-review/me/context')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(studentRes.status).toBe(200);
      expect(studentRes.body.data.role).toBe('STUDENT');
      expect(studentRes.body.data.plan.code).toBe('PREMIUM');
      expect(typeof studentRes.body.data.plan.startedAt).toBe('string');

      const serialized = JSON.stringify(studentRes.body);
      expect(serialized).not.toContain('linh.tt@edu.vn');
      expect(serialized).not.toContain('20210002');
      expect(serialized).not.toContain('Trần Thị Linh');

      // 5. STUDENT có subscription EXPIRED -> đọc DB trả FREE (không tin mù claim JWT)
      const expiredRes = await request(testApp)
        .get('/api/v1/ai-review/me/context')
        .set('Authorization', `Bearer ${studentExpiredToken}`);
      expect(expiredRes.status).toBe(200);
      expect(expiredRes.body.data.plan.code).toBe('FREE');
    } finally {
      await mod?.stop();
    }
  });

  it('Host Adapters thỏa mãn contract: QuestionPoolPort chỉ trả câu APPROVED không lộ đáp án; AttemptHistoryPort lọc đúng user', async () => {
    const ports = createAiReviewHostPorts();

    const pool = await ports.questionPool.findCandidates({ topics: ['CTDL'], limit: 30 });
    expect(pool.length).toBeGreaterThan(0);
    for (const q of pool) {
      expect(q.topic).toBe('CTDL');
      expect(q.id).not.toBe('q-draft-ctdl-1');
      expect(q).not.toHaveProperty('correctIndex');
      expect(q).not.toHaveProperty('explanation');
    }

    const filtered = await ports.questionPool.getByIds([
      'q-ctdl-1',
      'q-draft-ctdl-1',
      'q-does-not-exist',
    ]);
    expect(filtered.map((q) => q.id)).toEqual(['q-ctdl-1']);

    const history = await ports.attemptHistory.listAnswers(studentLinhId, { limit: 50 });
    expect(history.length).toBeGreaterThan(0);
    for (const item of history) {
      expect(typeof item.questionId).toBe('string');
      expect(typeof item.isCorrect).toBe('boolean');
      expect(typeof item.timeSpentMs).toBe('number');
    }
  });

  it('Lệch major CONTRACT_VERSION: module từ chối khởi động (trả null), core vẫn tiếp tục chạy bình thường', async () => {
    const testApp = express();
    testApp.get('/core-ping', (_req, res) => res.json({ ok: true }));

    const mod = await mountAiReviewModule(testApp, {
      contractVersion: 99,
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
      },
    });
    expect(mod).toBeNull();

    const ping = await request(testApp).get('/core-ping');
    expect(ping.status).toBe(200);
    const modStatus = await request(testApp).get('/api/v1/ai-review/status');
    expect(modStatus.status).toBe(404);
  });

  it('Phase 2: GET /api/v1/ai-review/quota trả đúng hạn mức theo plan và thay thế checkQuota("ai_questions") của core', async () => {
    const email = `quota_p2_${Date.now()}@edu.vn`;
    const reg = await request(app).post('/api/v1/auth/register').send({
      displayName: 'SV Quota Phase 2',
      email,
      studentId: '20249988',
      university: 'ĐH Bách Khoa Hà Nội',
      password: 'password123',
      confirmPassword: 'password123',
      agree: true,
    });
    expect(reg.status).toBe(201);
    const freeToken = reg.body.data.accessToken;
    const freeUserId = reg.body.data.user.id;

    const testApp = express();
    testApp.use(express.json());
    // Route sử dụng middleware core checkQuota('ai_questions') — phải được thay thế bởi quota mới khi module bật
    testApp.get(
      '/api/v1/core-ai-endpoint',
      requireAuth,
      checkQuota('ai_questions'),
      (_req, res) => res.status(200).json({ data: { ok: true }, error: null })
    );

    const mod = await mountAiReviewModule(testApp, {
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
      },
    });
    expect(mod).not.toBeNull();

    try {
      // 1. GET /quota cho STUDENT FREE -> exam_sets=3/ngày, llm_tokens=150,000/tháng
      const freeSnap = await request(testApp)
        .get('/api/v1/ai-review/quota')
        .set('Authorization', `Bearer ${freeToken}`);
      expect(freeSnap.status).toBe(200);
      expect(freeSnap.body.data.plan).toBe('FREE');
      expect(freeSnap.body.data.quotas.exam_sets.limit).toBe(3);
      expect(freeSnap.body.data.quotas.llm_tokens.limit).toBe(150_000);

      // 2. GET /quota cho STUDENT PREMIUM -> exam_sets=30/ngày, llm_tokens=5,000,000/tháng
      const proSnap = await request(testApp)
        .get('/api/v1/ai-review/quota')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(proSnap.status).toBe(200);
      expect(proSnap.body.data.plan).toBe('PREMIUM');
      expect(proSnap.body.data.quotas.exam_sets.limit).toBe(30);
      expect(proSnap.body.data.quotas.llm_tokens.limit).toBe(5_000_000);

      // 3. LECTURER bị chặn 403
      const lecSnap = await request(testApp)
        .get('/api/v1/ai-review/quota')
        .set('Authorization', `Bearer ${lecturerToken}`);
      expect(lecSnap.status).toBe(403);

      // 4. checkQuota('ai_questions') đã bị thay thế: FREE bị chặn ở lần thứ 4 (limit 3 của quota mới, không phải 10 của Redis cũ)
      for (let i = 1; i <= 3; i++) {
        const okRes = await request(testApp)
          .get('/api/v1/core-ai-endpoint')
          .set('Authorization', `Bearer ${freeToken}`);
        expect(okRes.status).toBe(200);
        expect(okRes.headers['x-quota-limit']).toBe('3');
        expect(okRes.headers['x-quota-remaining']).toBe(String(3 - i));
        expect(okRes.headers['x-quota-reset']).toMatch(/\+07:00$/);
      }

      const blockedRes = await request(testApp)
        .get('/api/v1/core-ai-endpoint')
        .set('Authorization', `Bearer ${freeToken}`);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThan(0);

      // 5. user.deleted event dọn usage_counters
      coreEventBus.emit('user.deleted', { userId: freeUserId, at: new Date().toISOString() });
    } finally {
      await mod?.stop();
      await prisma.user.deleteMany({ where: { id: freeUserId } });
    }
  });

  it('Phase 3: /me/profile và /me/attempts tối giản PII, chặn override student_id và chỉ cho phép STUDENT', async () => {
    const testApp = express();
    testApp.use(express.json());

    const mod = await mountAiReviewModule(testApp, {
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
      },
      replaceCoreAiQuota: false,
    });
    expect(mod).not.toBeNull();

    try {
      // 1. STUDENT đọc profile tối giản (zero PII)
      const prof = await request(testApp)
        .get('/api/v1/ai-review/me/profile')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(prof.status).toBe(200);
      expect(prof.body.data.alias).toBe('Học viên');
      expect(prof.body.data.plan).toBe('PREMIUM');
      const profStr = JSON.stringify(prof.body);
      expect(profStr).not.toContain('linh.tt@edu.vn');
      expect(profStr).not.toContain('20210002');
      expect(profStr).not.toContain('Trần Thị Linh');

      // 2. STUDENT đọc lịch sử làm bài tối giản (lấy từ practice_answers Phase 0)
      const att = await request(testApp)
        .get('/api/v1/ai-review/me/attempts?limit=50')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(att.status).toBe(200);
      expect(att.body.data.items.length).toBeGreaterThan(0);
      expect(att.body.data.items[0]).toHaveProperty('question_id');
      expect(att.body.data.items[0]).toHaveProperty('answered_on');
      expect(att.body.data.items[0]).not.toHaveProperty('prompt');
      expect(att.body.data.items[0]).not.toHaveProperty('explanation');

      // 3. Chặn truyền student_id tuỳ ý -> 403 FORBIDDEN_STUDENT_OVERRIDE
      const spoof = await request(testApp)
        .get('/api/v1/ai-review/me/attempts?student_id=someone_else')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(spoof.status).toBe(403);
      expect(spoof.body.error.code).toBe('FORBIDDEN_STUDENT_OVERRIDE');

      // 4. LECTURER bị chặn 403 FORBIDDEN_ROLE
      const lec = await request(testApp)
        .get('/api/v1/ai-review/me/profile')
        .set('Authorization', `Bearer ${lecturerToken}`);
      expect(lec.status).toBe(403);
      expect(lec.body.error.code).toBe('FORBIDDEN_ROLE');
    } finally {
      await mod?.stop();
    }
  });

  it('Phase 4: End-to-end gợi ý điểm yếu & dựng bộ đề 20 câu từ 112 câu APPROVED trong DB thật (lọc ID giả/DRAFT & chống IDOR)', async () => {
    const testApp = express();
    testApp.use(express.json());

    const mod = await mountAiReviewModule(testApp, {
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
      },
      replaceCoreAiQuota: false,
    });
    expect(mod).not.toBeNull();

    try {
      // 1. GET /recommendations trên lịch sử thật của linh.tt@edu.vn (có 3 câu sai HDH từ 10 ngày trước)
      const rec = await request(testApp)
        .get('/api/v1/ai-review/recommendations')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(rec.status).toBe(200);
      expect(rec.body.data.source).toBe('rule_based');
      expect(rec.body.data.weak_topics).toContain('HDH');
      expect(rec.body.data.spaced_review_due_count).toBeGreaterThanOrEqual(3);

      // 2. POST /exam-sets dựng bộ đề 20 câu kèm ID giả + ID DRAFT để kiểm chứng chống hallucination
      const idempKey = crypto.randomUUID();
      const created = await request(testApp)
        .post('/api/v1/ai-review/exam-sets')
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .set('Idempotency-Key', idempKey)
        .send({
          goal: 'Ôn tập 20 câu cá nhân hóa cuối kỳ',
          exam_ids: ['q-draft-ctdl-1', 'q-fake-hallucinated-999'],
        });
      expect(created.status).toBe(201);
      expect(created.body.data.requested).toBe(20);
      expect(created.body.data.fulfilled).toBe(20);
      expect(created.body.data.source).toBe('rule_based');
      expect(created.body.data.rejected_ids).toEqual([
        { id: 'q-draft-ctdl-1', reason: 'NOT_FOUND' },
        { id: 'q-fake-hallucinated-999', reason: 'NOT_FOUND' },
      ]);

      const returnedIds: string[] = created.body.data.items.map((i: any) => i.question_id);
      expect(new Set(returnedIds).size).toBe(20);

      // 100% ID trả về phải tồn tại trong DB core và có status = APPROVED
      const dbApproved = await prisma.question.findMany({
        where: { id: { in: returnedIds }, status: QuestionStatus.APPROVED },
        select: { id: true },
      });
      expect(dbApproved).toHaveLength(20);

      // Không chứa các câu WEB_CLOUD mới làm đúng 2 ngày trước của linh (pa-seed-linh-2)
      expect(returnedIds).not.toContain('q-web-1');
      expect(returnedIds).not.toContain('q-web-2');

      // 3. GET /exam-sets/:id trả đầy đủ prompt & options để làm bài, KHÔNG lộ đáp án
      const examSetId = created.body.data.exam_set_id;
      const detail = await request(testApp)
        .get(`/api/v1/ai-review/exam-sets/${examSetId}`)
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.items).toHaveLength(20);
      expect(typeof detail.body.data.items[0].prompt).toBe('string');
      expect(Array.isArray(detail.body.data.items[0].options)).toBe(true);
      expect(detail.body.data.items[0]).not.toHaveProperty('correctIndex');
      expect(detail.body.data.items[0]).not.toHaveProperty('explanation');

      // 4. Chống IDOR: sinh viên khác (trang.lt@edu.vn) bị 404
      const other = await request(testApp)
        .get(`/api/v1/ai-review/exam-sets/${examSetId}`)
        .set('Authorization', `Bearer ${studentExpiredToken}`);
      expect(other.status).toBe(404);
      expect(other.body.error.code).toBe('EXAM_SET_NOT_FOUND');
    } finally {
      await mod?.stop();
    }
  });

  it('Phase 5: STUDENT đọc lộ trình awesome-roadmaps (0PL) và dựng bộ đề CSDL theo roadmap_topic_ids; LECTURER bị 403', async () => {
    const testApp = express();
    testApp.use(express.json());

    const mod = await mountAiReviewModule(testApp, {
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
      },
      replaceCoreAiQuota: false,
    });
    expect(mod).not.toBeNull();

    try {
      const rmList = await request(testApp)
        .get('/api/v1/ai-review/roadmaps')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(rmList.status).toBe(200);
      expect(rmList.body.data.length).toBeGreaterThanOrEqual(9);

      const search = await request(testApp)
        .get('/api/v1/ai-review/roadmap-topics/search?q=SQL')
        .set('Authorization', `Bearer ${studentPremiumToken}`);
      expect(search.status).toBe(200);
      expect(search.body.data.items.some((i: any) => i.id === 'rm:articles-books:sql-roadmap')).toBe(true);

      const lecBlocked = await request(testApp)
        .get('/api/v1/ai-review/roadmaps')
        .set('Authorization', `Bearer ${lecturerToken}`);
      expect(lecBlocked.status).toBe(403);

      // Dựng đề từ roadmap_topic_ids -> lọc đúng câu hỏi CSDL APPROVED từ core DB
      const fromRoadmap = await request(testApp)
        .post('/api/v1/ai-review/exam-sets')
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          goal: 'Luyện tập CSDL theo SQL Roadmap',
          roadmap_topic_ids: ['rm:articles-books:sql-roadmap'],
          num_questions: 10,
        });
      expect(fromRoadmap.status).toBe(201);
      expect(fromRoadmap.body.data.fulfilled).toBe(10);
      expect(fromRoadmap.body.data.items.every((i: any) => i.topic === 'CSDL')).toBe(true);
    } finally {
      await mod?.stop();
    }
  });

  it('Phase 7: STUDENT gọi POST /summary & POST /exam-sets (use_ai=true) qua GeminiProvider mock (header x-goog-api-key, model từ env, ZERO PII, LECTURER bị 403)', async () => {
    const testApp = express();
    testApp.use(express.json());
    const secretKey = 'AIzaSyHostIntegrationTestKey123456789';
    const seenUrls: string[] = [];
    const seenAuthHeaders: string[] = [];
    const seenBodies: string[] = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const rawBody = String(init?.body ?? '{}');
      seenUrls.push(url);
      seenAuthHeaders.push(headers['x-goog-api-key'] ?? '');
      seenBodies.push(rawBody);

      const reqJson = JSON.parse(rawBody);
      const promptText: string = reqJson.contents?.[0]?.parts?.[0]?.text ?? '';

      // Detect exam-set ranking vs summary
      const candMatch = promptText.match(
        /<data\s+label="candidate_questions"\s+untrusted="true">\s*([\s\S]*?)\s*<\/data>/
      );
      if (candMatch) {
        const parsed = JSON.parse(candMatch[1]);
        const pickedIds = parsed.candidates.slice(0, parsed.requested).map((c: any) => c.id);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        selected_question_ids: pickedIds,
                        rationale: 'Bộ 20 câu do AI sắp xếp ưu tiên chủ đề HDH và câu từng làm sai.',
                      }),
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: { promptTokenCount: 520, candidatesTokenCount: 180, totalTokenCount: 700 },
          }),
          { status: 200 }
        );
      }

      const rmMatch = promptText.match(
        /<data\s+label="roadmap_references"\s+untrusted="true">\s*([\s\S]*?)\s*<\/data>/
      );
      const rms = rmMatch ? JSON.parse(rmMatch[1]) : [];
      const firstRm = rms[0];

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary:
                        'Kết quả cho thấy bạn nên củng cố Hệ điều hành (HDH) và hoàn thành các câu ôn ngắt quãng.',
                      weakness_insights: [
                        {
                          topic: 'HDH',
                          diagnosis: 'Tỉ lệ trả lời đúng ở HDH đang thấp hơn các chủ đề khác.',
                          action_step: 'Làm bộ 20 câu adaptive tập trung HDH và ôn lại các câu sai.',
                        },
                      ],
                      study_plan: [
                        {
                          step: 1,
                          title: 'Ôn tập nền tảng Hệ điều hành và lộ trình tham khảo',
                          focus_topics: ['HDH'],
                          ...(firstRm
                            ? { roadmap_topic_id: firstRm.id, reference_url: firstRm.source_url }
                            : {}),
                          estimated_minutes: 45,
                        },
                      ],
                    }),
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 380, candidatesTokenCount: 160, totalTokenCount: 540 },
        }),
        { status: 200 }
      );
    };

    const mod = await mountAiReviewModule(testApp, {
      fetchFn: mockFetch,
      envSource: {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'gemini',
        AI_REVIEW_LLM_MODEL: 'gemini-4-medium',
        AI_REVIEW_LLM_API_KEY: secretKey,
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
      },
      replaceCoreAiQuota: false,
    });
    expect(mod).not.toBeNull();

    try {
      // 1. LECTURER bị chặn 403
      const lecSum = await request(testApp)
        .post('/api/v1/ai-review/summary')
        .set('Authorization', `Bearer ${lecturerToken}`)
        .send({ goal: 'Xem thử AI review' });
      expect(lecSum.status).toBe(403);

      // 2. STUDENT gọi POST /summary -> 200 với source='llm', model='gemini-4-medium'
      const sumRes = await request(testApp)
        .post('/api/v1/ai-review/summary')
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .send({ goal: 'Ôn tập cuối kỳ các chủ đề yếu' });
      expect(sumRes.status).toBe(200);
      expect(sumRes.body.data.source).toBe('llm');
      expect(sumRes.body.data.model_id).toBe('gemini-4-medium');
      expect(sumRes.body.data.usage.totalTokens).toBe(540);
      expect(sumRes.body.data.study_plan.length).toBeGreaterThanOrEqual(1);

      // 3. STUDENT gọi POST /exam-sets với use_ai=true -> 201 với 20 câu APPROVED từ DB core
      const aiSetRes = await request(testApp)
        .post('/api/v1/ai-review/exam-sets')
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          goal: 'Bộ đề 20 câu do AI tối ưu hóa',
          use_ai: true,
        });
      expect(aiSetRes.status).toBe(201);
      expect(aiSetRes.body.data.source).toBe('llm');
      expect(aiSetRes.body.data.model_id).toBe('gemini-4-medium');
      expect(aiSetRes.body.data.fulfilled).toBe(20);
      expect(aiSetRes.body.data.llm_usage.totalTokens).toBe(700);

      // Xác minh API key chỉ nằm ở header x-goog-api-key (KHÔNG nằm trong URL) & ZERO PII gửi sang Gemini
      expect(seenUrls.length).toBe(2);
      for (const u of seenUrls) {
        expect(u).toContain('/models/gemini-4-medium:generateContent');
        expect(u).not.toContain('key=');
        expect(u).not.toContain(secretKey);
      }
      expect(seenAuthHeaders).toEqual([secretKey, secretKey]);
      for (const b of seenBodies) {
        expect(b).not.toContain('linh.tt@edu.vn');
        expect(b).not.toContain('Trần Thị Linh');
        expect(b).not.toContain('20210002');
        expect(b).not.toContain('correctIndex');
      }
    } finally {
      await mod?.stop();
    }
  });
});
