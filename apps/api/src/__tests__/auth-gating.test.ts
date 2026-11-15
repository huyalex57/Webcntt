import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';

describe('Auth & Gating Integration Tests', () => {
  let studentAccessToken: string;
  let studentRefreshTokenCookie: string;
  let studentPremiumAccessToken: string;
  let lecturerAccessToken: string;
  let lecturerPremiumAccessToken: string;

  beforeAll(async () => {
    // 1. Đăng nhập Student Free
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'huy.nd@edu.vn', password: 'password123' });
    expect(studentRes.status).toBe(200);
    studentAccessToken = studentRes.body.data.accessToken;
    studentRefreshTokenCookie = studentRes.headers['set-cookie'][0];

    // 2. Đăng nhập Student Premium
    const studentPremRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'linh.tt@edu.vn', password: 'password123' });
    expect(studentPremRes.status).toBe(200);
    studentPremiumAccessToken = studentPremRes.body.data.accessToken;

    // 3. Đăng nhập Lecturer Free
    const lecturerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tuan.tm@hust.edu.vn', password: 'password123' });
    expect(lecturerRes.status).toBe(200);
    lecturerAccessToken = lecturerRes.body.data.accessToken;

    // 4. Đăng nhập Lecturer Premium
    const lecturerPremRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bao.tq@hust.edu.vn', password: 'password123' });
    expect(lecturerPremRes.status).toBe(200);
    lecturerPremiumAccessToken = lecturerPremRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  describe('Health Checks', () => {
    it('GET /health trả về 200 ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
    });

    it('GET /ready xác nhận kết nối DB và Redis', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.data.database).toBe('connected');
      expect(res.body.data.redis).toBe('connected');
    });
  });

  describe('Auth Lifecycle & Token Rotation', () => {
    it('GET /api/v1/users/me trả về thông tin người dùng với Access Token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('huy.nd@edu.vn');
      expect(res.body.data.role).toBe('STUDENT');
      expect(res.body.data.plan).toBe('FREE');
    });

    it('POST /api/v1/auth/refresh thực hiện Rotation và cấp Access Token mới', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', studentRefreshTokenCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();

      const newCookie = res.headers['set-cookie'][0];
      expect(newCookie).toBeDefined();

      // Thử dùng lại cookie cũ (Token Reuse Attack) -> phải bị chặn 401
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', studentRefreshTokenCookie);

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    });
  });

  describe('RBAC & Feature Gating Verification', () => {
    it('Guest gọi route yêu cầu đăng nhập bị trả về 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/test/lecturer-only');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('STUDENT (kể cả có Premium) gọi route của LECTURER bị trả về 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/test/lecturer-only')
        .set('Authorization', `Bearer ${studentPremiumAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('LECTURER Free gọi route của LECTURER được chấp nhận (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/test/lecturer-only')
        .set('Authorization', `Bearer ${lecturerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Chào mừng Giảng viên');
    });

    it('LECTURER Free gọi route yêu cầu PREMIUM bị trả về 403 UPGRADE_REQUIRED', async () => {
      const res = await request(app)
        .get('/api/v1/test/premium-only')
        .set('Authorization', `Bearer ${lecturerAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('UPGRADE_REQUIRED');
    });

    it('LECTURER Premium gọi route yêu cầu PREMIUM thành công (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/test/premium-only')
        .set('Authorization', `Bearer ${lecturerPremiumAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Chào mừng Hội viên Premium');
    });
  });

  describe('Quota Gating với Redis (Free: 10 câu/ngày)', () => {
    it('Sinh viên Free vượt hạn mức 10 câu/ngày sẽ nhận 429 QUOTA_EXCEEDED', async () => {
      // Đăng ký một user sinh viên mới tinh để test quota
      const testEmail = `quota_test_${Date.now()}@edu.vn`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          displayName: 'Test Quota User',
          email: testEmail,
          password: 'password123',
          confirmPassword: 'password123',
          studentId: '99990001',
          university: 'HUST',
          agree: true,
        });

      const token = regRes.body.data.accessToken;

      // Gọi 10 lần thành công
      for (let i = 1; i <= 10; i++) {
        const res = await request(app)
          .get('/api/v1/test/ai-quota')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }

      // Lần thứ 11 phải nhận 429
      const overRes = await request(app)
        .get('/api/v1/test/ai-quota')
        .set('Authorization', `Bearer ${token}`);

      expect(overRes.status).toBe(429);
      expect(overRes.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(overRes.body.error.details.limit).toBe(10);
      expect(overRes.body.error.details.used).toBe(11);
    });
  });
});
