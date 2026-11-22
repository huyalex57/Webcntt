import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';

describe('AI Learning Path Integration Tests (Workflow §5.4)', () => {
  let studentFreeToken: string;
  let studentPremiumToken: string;
  let createdLearningPathId: string;
  let firstMilestoneId: string;
  let secondMilestoneId: string;
  let remediationId: string;

  beforeAll(async () => {
    // Đăng nhập Student Free
    const freeRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'huy.nd@edu.vn', password: 'password123' });
    expect(freeRes.status).toBe(200);
    studentFreeToken = freeRes.body.data.accessToken;

    // Đăng nhập Student Premium
    const proRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'linh.tt@edu.vn', password: 'password123' });
    expect(proRes.status).toBe(200);
    studentPremiumToken = proRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  describe('Feature Gating & Validation', () => {
    it('Guest gọi tạo lộ trình bị chặn 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/courses/c1/generate-path')
        .send({
          targetGoal: 'Học React và Node.js để đi làm',
          currentLevel: 'TRUNG_BINH',
          hoursPerWeek: 8,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('Student FREE gọi tạo lộ trình bị chặn 403 UPGRADE_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/v1/courses/c1/generate-path')
        .set('Authorization', `Bearer ${studentFreeToken}`)
        .send({
          targetGoal: 'Học React và Node.js để đi làm',
          currentLevel: 'TRUNG_BINH',
          hoursPerWeek: 8,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('UPGRADE_REQUIRED');
    });

    it('Body không hợp lệ bị chặn 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/courses/c1/generate-path')
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .send({
          targetGoal: 'quá', // ít hơn 5 ký tự
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Generate Personalized Learning Path (Gemini 4 Hydrogen Medium)', () => {
    it('Student PREMIUM tạo lộ trình khoá học thành công (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/courses/c1/generate-path')
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .send({
          targetGoal: 'Nắm vững kiến trúc Monorepo, JWT Refresh Token Rotation và PostgreSQL Prisma để đạt điểm A',
          currentLevel: 'TRUNG_BINH',
          hoursPerWeek: 10,
        });

      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data.id).toBeDefined();
      expect(data.courseId).toBe('c1');
      expect(data.modelName).toBe('gemini-4-hydrogen-medium');
      expect(data.milestones.length).toBeGreaterThanOrEqual(2);

      // Milestone 1 phải IN_PROGRESS, Milestone 2 phải LOCKED
      expect(data.milestones[0].status).toBe('IN_PROGRESS');
      expect(data.milestones[1].status).toBe('LOCKED');

      createdLearningPathId = data.id;
      firstMilestoneId = data.milestones[0].id;
      secondMilestoneId = data.milestones[1].id;
    });

    it('GET /api/v1/courses/:id/learning-path trả về lộ trình vừa tạo', async () => {
      const res = await request(app)
        .get('/api/v1/courses/c1/learning-path')
        .set('Authorization', `Bearer ${studentPremiumToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdLearningPathId);
      expect(res.body.data.milestones.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Evaluate Milestone & Adaptive Remediation', () => {
    it('Chưa đạt điểm chuẩn (<70%): Milestone -> NEEDS_REVIEW, trả về Remediation bổ trợ', async () => {
      // Gửi đáp án sai toàn bộ
      const res = await request(app)
        .post(`/api/v1/milestones/${firstMilestoneId}/evaluate`)
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .send({
          answers: {
            'm1-q1': 3, // sai
            'm1-q2': 0, // sai
            'm1-q3': 3, // sai
          },
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.passed).toBe(false);
      expect(data.status).toBe('NEEDS_REVIEW');
      expect(data.score).toBeLessThan(70);
      expect(data.remediation).toBeDefined();
      expect(data.remediation.weaknessAnalysis).toBeDefined();
      expect(data.remediation.remedialQuestions.length).toBeGreaterThan(0);

      remediationId = data.remediation.id;
    });

    it('POST /remediations/:id/complete chuyển Milestone lại thành IN_PROGRESS để thi lại', async () => {
      const res = await request(app)
        .post(`/api/v1/remediations/${remediationId}/complete`)
        .set('Authorization', `Bearer ${studentPremiumToken}`);

      expect(res.status).toBe(200);

      // Kiểm tra trạng thái milestone
      const pathRes = await request(app)
        .get('/api/v1/courses/c1/learning-path')
        .set('Authorization', `Bearer ${studentPremiumToken}`);

      const m1 = pathRes.body.data.milestones.find((m: any) => m.id === firstMilestoneId);
      expect(m1.status).toBe('IN_PROGRESS');
    });

    it('Đạt điểm chuẩn (>=70%): Milestone 1 -> COMPLETED, Milestone 2 tự động mở khoá IN_PROGRESS', async () => {
      // Gửi đáp án đúng toàn bộ (m1-q1: 0, m1-q2: 1, m1-q3: 1)
      const res = await request(app)
        .post(`/api/v1/milestones/${firstMilestoneId}/evaluate`)
        .set('Authorization', `Bearer ${studentPremiumToken}`)
        .send({
          answers: {
            'm1-q1': 0,
            'm1-q2': 1,
            'm1-q3': 1,
          },
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.passed).toBe(true);
      expect(data.status).toBe('COMPLETED');
      expect(data.score).toBe(100);
      expect(data.nextMilestoneId).toBe(secondMilestoneId);

      // Xác minh Milestone 2 đã chuyển thành IN_PROGRESS
      const pathRes = await request(app)
        .get('/api/v1/courses/c1/learning-path')
        .set('Authorization', `Bearer ${studentPremiumToken}`);

      const m2 = pathRes.body.data.milestones.find((m: any) => m.id === secondMilestoneId);
      expect(m2.status).toBe('IN_PROGRESS');
    });
  });
});
