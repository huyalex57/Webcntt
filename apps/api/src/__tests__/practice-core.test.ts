import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { QuestionStatus, ResourceTopic } from '@prisma/client';
import { app } from '../index.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import { coreEventBus, type CoreEventMap } from '../events/bus.js';

describe('Phase 0 — Core Question Bank, Practice Attempts & EventBus', () => {
  const ts = Date.now();
  const student1Email = `practice_p0_s1_${ts}@edu.vn`;
  const student2Email = `practice_p0_s2_${ts}@edu.vn`;
  let student1Id = '';
  let student2Id = '';
  let student1Token = '';
  let student2Token = '';
  let createdAttemptId = '';

  beforeAll(async () => {
    const reg1 = await request(app).post('/api/v1/auth/register').send({
      displayName: 'SV Practice Test 1',
      email: student1Email,
      studentId: '20239001',
      university: 'ĐH Bách Khoa Hà Nội',
      password: 'password123',
      confirmPassword: 'password123',
      agree: true,
    });
    expect(reg1.status).toBe(201);
    student1Id = reg1.body.data.user.id;
    student1Token = reg1.body.data.accessToken;

    const reg2 = await request(app).post('/api/v1/auth/register').send({
      displayName: 'SV Practice Test 2',
      email: student2Email,
      studentId: '20239002',
      university: 'ĐH Công nghệ — ĐHQGHN',
      password: 'password123',
      confirmPassword: 'password123',
      agree: true,
    });
    expect(reg2.status).toBe(201);
    student2Id = reg2.body.data.user.id;
    student2Token = reg2.body.data.accessToken;
  });

  afterAll(async () => {
    coreEventBus.removeAllListeners('attempt.completed');
    await prisma.user.deleteMany({
      where: { id: { in: [student1Id, student2Id].filter(Boolean) } },
    });
    await prisma.$disconnect();
    redis.disconnect();
  });

  describe('Ngân hàng câu hỏi (questions)', () => {
    it('DB có >= 100 câu hỏi APPROVED phủ đủ cả 7 ResourceTopic', async () => {
      const grouped = await prisma.question.groupBy({
        by: ['topic'],
        where: { status: QuestionStatus.APPROVED },
        _count: { _all: true },
      });

      const totalApproved = grouped.reduce((sum, g) => sum + g._count._all, 0);
      expect(totalApproved).toBeGreaterThanOrEqual(100);

      const allTopics = Object.values(ResourceTopic);
      const presentTopics = new Set(grouped.map((g) => g.topic));
      for (const topic of allTopics) {
        expect(presentTopics.has(topic)).toBe(true);
      }
    });

    it('Guest gọi GET /api/v1/practice/questions bị chặn 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/practice/questions');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/v1/practice/questions chỉ trả câu APPROVED, hỗ trợ lọc và KHÔNG lộ đáp án đúng / giải thích', async () => {
      const res = await request(app)
        .get('/api/v1/practice/questions?topic=CTDL&difficulty=MEDIUM&limit=20')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const q of res.body.data) {
        expect(q.topic).toBe('CTDL');
        expect(q.difficulty).toBe('MEDIUM');
        expect(q.id).not.toBe('q-draft-ctdl-1');
        expect(q).not.toHaveProperty('correctIndex');
        expect(q).not.toHaveProperty('explanation');
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('GET /api/v1/practice/questions lọc theo tag và từ chối query sai định dạng (400)', async () => {
      const tagRes = await request(app)
        .get('/api/v1/practice/questions?tag=postgresql')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(tagRes.status).toBe(200);
      expect(tagRes.body.data.length).toBeGreaterThan(0);
      for (const q of tagRes.body.data) {
        expect(q.tags).toContain('postgresql');
      }

      const invalidRes = await request(app)
        .get('/api/v1/practice/questions?topic=INVALID_TOPIC')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Nộp bài luyện tập 20 câu (practice_attempts, practice_answers, SkillProfile & EventBus)', () => {
    it('POST /api/v1/practice/attempts chấm điểm bộ đề 20 câu phía server, lưu DB, cập nhật SkillProfile và phát attempt.completed', async () => {
      // Lấy 20 câu APPROVED (10 CSDL + 10 CTDL) để tạo một "Đề" 20 câu
      const csdlQs = await prisma.question.findMany({
        where: { topic: ResourceTopic.CSDL, status: QuestionStatus.APPROVED },
        orderBy: { id: 'asc' },
        take: 10,
      });
      const ctdlQs = await prisma.question.findMany({
        where: { topic: ResourceTopic.CTDL, status: QuestionStatus.APPROVED },
        orderBy: { id: 'asc' },
        take: 10,
      });
      expect(csdlQs.length).toBe(10);
      expect(ctdlQs.length).toBe(10);

      // Lắng nghe sự kiện attempt.completed (+ 1 listener cố tình ném lỗi để kiểm chứng error isolation)
      const receivedEvents: CoreEventMap['attempt.completed'][] = [];
      const unsubOk = coreEventBus.on('attempt.completed', (payload) => {
        receivedEvents.push(payload);
      });
      const unsubBroken = coreEventBus.on('attempt.completed', () => {
        throw new Error('Simulated failing subscriber must not break core');
      });

      // CSDL: đúng 4/10 (40% -> weak = true); CTDL: đúng 8/10 (80% -> weak = false); tổng 12/20 = 60%
      const answersPayload = [
        ...csdlQs.map((q, idx) => {
          const opts = q.options as string[];
          return {
            questionId: q.id,
            selectedIndex: idx < 4 ? q.correctIndex : idx === 9 ? null : (q.correctIndex + 1) % opts.length,
            timeSpentMs: 35_000 + idx * 1000,
          };
        }),
        ...ctdlQs.map((q, idx) => {
          const opts = q.options as string[];
          return {
            questionId: q.id,
            selectedIndex: idx < 8 ? q.correctIndex : (q.correctIndex + 1) % opts.length,
            timeSpentMs: 25_000 + idx * 1000,
          };
        }),
      ];

      const res = await request(app)
        .post('/api/v1/practice/attempts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          practiceSetId: 'ps-test-20q-001',
          answers: answersPayload,
        });

      unsubOk();
      unsubBroken();

      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data.attempt.practiceSetId).toBe('ps-test-20q-001');
      expect(data.attempt.topic).toBeNull(); // đề trộn 2 topic
      expect(data.attempt.totalQuestions).toBe(20);
      expect(data.attempt.correctCount).toBe(12);
      expect(data.attempt.score).toBe(60);
      expect(data.answers).toHaveLength(20);
      expect(typeof data.answers[0].correctIndex).toBe('number');
      expect(typeof data.answers[0].explanation).toBe('string');

      createdAttemptId = data.attempt.id;

      // Kiểm chứng PracticeAnswer lưu thật trong DB
      const dbAnswers = await prisma.practiceAnswer.findMany({
        where: { attemptId: createdAttemptId },
      });
      expect(dbAnswers).toHaveLength(20);
      expect(dbAnswers.filter((a) => a.isCorrect)).toHaveLength(12);
      expect(dbAnswers.every((a) => a.userId === student1Id && a.timeSpentMs > 0)).toBe(true);

      // Kiểm chứng SkillProfile được cập nhật
      const skillRes = await request(app)
        .get('/api/v1/practice/skill-profiles')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(skillRes.status).toBe(200);
      const csdlSkill = skillRes.body.data.find((s: any) => s.topic === 'CSDL');
      const ctdlSkill = skillRes.body.data.find((s: any) => s.topic === 'CTDL');
      expect(csdlSkill).toEqual({ topic: 'CSDL', accuracy: 40, answered: 10, weak: true });
      expect(ctdlSkill).toEqual({ topic: 'CTDL', accuracy: 80, answered: 10, weak: false });

      // Kiểm chứng event attempt.completed đã được phát
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toMatchObject({
        userId: student1Id,
        attemptId: createdAttemptId,
        practiceSetId: 'ps-test-20q-001',
        totalQuestions: 20,
        correctCount: 12,
        score: 60,
      });
    });

    it('Từ chối câu hỏi DRAFT, ID không tồn tại, trùng questionId và selectedIndex ngoài phạm vi', async () => {
      // 1. Câu hỏi DRAFT
      const draftRes = await request(app)
        .post('/api/v1/practice/attempts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          answers: [{ questionId: 'q-draft-ctdl-1', selectedIndex: 1, timeSpentMs: 10_000 }],
        });
      expect(draftRes.status).toBe(400);
      expect(draftRes.body.error.code).toBe('INVALID_QUESTION_IDS');

      // 2. ID không tồn tại (chống hallucination / giả mạo)
      const ghostRes = await request(app)
        .post('/api/v1/practice/attempts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          answers: [{ questionId: 'q-non-existent-999', selectedIndex: 0, timeSpentMs: 5_000 }],
        });
      expect(ghostRes.status).toBe(400);
      expect(ghostRes.body.error.code).toBe('INVALID_QUESTION_IDS');

      // 3. Trùng questionId trong cùng 1 lượt nộp
      const dupRes = await request(app)
        .post('/api/v1/practice/attempts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          answers: [
            { questionId: 'q-ctdl-1', selectedIndex: 2, timeSpentMs: 5_000 },
            { questionId: 'q-ctdl-1', selectedIndex: 2, timeSpentMs: 5_000 },
          ],
        });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.error.code).toBe('VALIDATION_ERROR');

      // 4. selectedIndex vượt số đáp án
      const oobRes = await request(app)
        .post('/api/v1/practice/attempts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          answers: [{ questionId: 'q-ctdl-2', selectedIndex: 9, timeSpentMs: 5_000 }],
        });
      expect(oobRes.status).toBe(400);
      expect(oobRes.body.error.code).toBe('INVALID_ANSWER_INDEX');
    });
  });

  describe('Lịch sử làm bài & chống IDOR', () => {
    it('Chủ sở hữu xem được danh sách & chi tiết lượt làm bài; người dùng khác bị chặn 404', async () => {
      const listRes = await request(app)
        .get('/api/v1/practice/attempts')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((a: any) => a.id === createdAttemptId)).toBe(true);

      const ownerDetail = await request(app)
        .get(`/api/v1/practice/attempts/${createdAttemptId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(ownerDetail.status).toBe(200);
      expect(ownerDetail.body.data.attempt.id).toBe(createdAttemptId);
      expect(ownerDetail.body.data.answers).toHaveLength(20);

      // Chống IDOR: student2 không thể xem lượt làm bài của student1
      const otherDetail = await request(app)
        .get(`/api/v1/practice/attempts/${createdAttemptId}`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(otherDetail.status).toBe(404);
      expect(otherDetail.body.error.code).toBe('ATTEMPT_NOT_FOUND');
    });
  });
});
