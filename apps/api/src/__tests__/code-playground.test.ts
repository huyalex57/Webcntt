import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';

function b64(s: string) {
  return Buffer.from(s, 'utf8').toString('base64');
}

describe('Code Playground & Judge0 Integration Tests (Issue #36)', () => {
  let freeStudentToken: string;
  let freeStudentId: string;
  let premiumStudentToken: string;

  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    // Tạo user Free mới để test quota 30 lần/ngày & 3 snippets sạch sẽ
    const freeEmail = `playground_free_${Date.now()}@edu.vn`;
    const regFree = await request(app)
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Playground Free Tester',
        email: freeEmail,
        password: 'password123',
        confirmPassword: 'password123',
        studentId: '20269901',
        university: 'HUST',
        agree: true,
      });
    expect(regFree.status).toBe(201);
    freeStudentToken = regFree.body.data.accessToken;
    freeStudentId = regFree.body.data.user.id;

    // Đăng nhập Student Premium seeded
    const premLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'linh.tt@edu.vn', password: 'password123' });
    expect(premLogin.status).toBe(200);
    premiumStudentToken = premLogin.body.data.accessToken;
  });

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await prisma.user.deleteMany({ where: { id: freeStudentId } });
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('GET /api/v1/code/languages trả về danh sách 5 ngôn ngữ hỗ trợ kèm judge0Id và starterCode', async () => {
    const res = await request(app).get('/api/v1/code/languages');
    expect(res.status).toBe(200);
    const slugs = res.body.data.map((l: any) => l.slug);
    expect(slugs).toEqual(expect.arrayContaining(['c', 'cpp', 'python', 'java', 'go']));
    const cpp = res.body.data.find((l: any) => l.slug === 'cpp');
    expect(cpp.judge0Id).toBe(54);
    expect(cpp.starterCode).toContain('quickSort');
  });

  it('GET /api/v1/code/quota trả về đúng hạn mức tài nguyên FREE vs PREMIUM', async () => {
    const freeQuota = await request(app)
      .get('/api/v1/code/quota')
      .set('Authorization', `Bearer ${freeStudentToken}`);
    expect(freeQuota.status).toBe(200);
    expect(freeQuota.body.data.limit).toBe(30);
    expect(freeQuota.body.data.limits.cpuTimeLimitS).toBe(2);
    expect(freeQuota.body.data.limits.memoryLimitMb).toBe(128);
    expect(freeQuota.body.data.limits.snippetLimit).toBe(3);

    const premQuota = await request(app)
      .get('/api/v1/code/quota')
      .set('Authorization', `Bearer ${premiumStudentToken}`);
    expect(premQuota.status).toBe(200);
    expect(premQuota.body.data.limit).toBe(200);
    expect(premQuota.body.data.limits.cpuTimeLimitS).toBe(5);
    expect(premQuota.body.data.limits.memoryLimitMb).toBe(512);
    expect(premQuota.body.data.limits.snippetLimit).toBe(50);
  });

  it('POST /api/v1/code/run áp dụng ràng buộc sandbox (no-net, CPU/RAM theo gói), xử lý AC, CE, TLE, RE và ghi RunLog', async () => {
    const capturedPayloads: any[] = [];

    globalThis.fetch = vi.fn(async (_url: any, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      capturedPayloads.push(parsed);
      const source = Buffer.from(parsed.source_code, 'base64').toString('utf8');

      // Infinite loop -> TLE (Judge0 status 5)
      if (source.includes('while(true)') || source.includes('while True')) {
        return new Response(
          JSON.stringify({
            stdout: null,
            stderr: null,
            compile_output: null,
            message: b64('Time limit exceeded'),
            time: '2.001',
            memory: 14200,
            exit_code: 124,
            status: { id: 5, description: 'Time Limit Exceeded' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Syntax error -> CE (Judge0 status 6)
      if (source.includes('SYNTAX_ERROR')) {
        return new Response(
          JSON.stringify({
            stdout: null,
            stderr: null,
            compile_output: b64("main.cpp:3:1: error: 'SYNTAX_ERROR' was not declared in this scope"),
            message: null,
            time: '0.000',
            memory: 0,
            exit_code: 1,
            status: { id: 6, description: 'Compilation Error' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Malicious network/filesystem call blocked by sandbox -> RE (Judge0 status 11)
      if (source.includes('socket.connect')) {
        return new Response(
          JSON.stringify({
            stdout: null,
            stderr: b64('OSError: [Errno 101] Network is unreachable'),
            compile_output: null,
            message: null,
            time: '0.032',
            memory: 9120,
            exit_code: 1,
            status: { id: 11, description: 'Runtime Error (NZEC)' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Normal execution -> AC (Judge0 status 3)
      return new Response(
        JSON.stringify({
          stdout: b64('Hello, DevStudy Hub!\n'),
          stderr: null,
          compile_output: null,
          message: null,
          time: '0.045',
          memory: 12288,
          exit_code: 0,
          status: { id: 3, description: 'Accepted' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    // 1. AC run (FREE user)
    const acRes = await request(app)
      .post('/api/v1/code/run')
      .set('Authorization', `Bearer ${freeStudentToken}`)
      .send({
        language: 'python',
        code: 'print("Hello, DevStudy Hub!")',
        stdin: '',
      });
    expect(acRes.status).toBe(200);
    expect(acRes.body.data.status).toBe('AC');
    expect(acRes.body.data.stdout).toBe('Hello, DevStudy Hub!\n');
    expect(acRes.body.data.timeMs).toBe(45);
    expect(acRes.body.data.memoryKb).toBe(12288);
    expect(capturedPayloads[0].enable_network).toBe(false);
    expect(capturedPayloads[0].cpu_time_limit).toBe(2);
    expect(capturedPayloads[0].memory_limit).toBe(128 * 1024);

    // 2. CE run
    const ceRes = await request(app)
      .post('/api/v1/code/run')
      .set('Authorization', `Bearer ${freeStudentToken}`)
      .send({
        language: 'cpp',
        code: 'int main() { SYNTAX_ERROR }',
        stdin: '',
      });
    expect(ceRes.status).toBe(200);
    expect(ceRes.body.data.status).toBe('CE');
    expect(ceRes.body.data.compile_output).toContain('SYNTAX_ERROR');

    // 3. TLE run
    const tleRes = await request(app)
      .post('/api/v1/code/run')
      .set('Authorization', `Bearer ${freeStudentToken}`)
      .send({
        language: 'python',
        code: 'while True: pass',
        stdin: '',
      });
    expect(tleRes.status).toBe(200);
    expect(tleRes.body.data.status).toBe('TLE');

    // 4. Sandbox network block -> RE
    const reRes = await request(app)
      .post('/api/v1/code/run')
      .set('Authorization', `Bearer ${freeStudentToken}`)
      .send({
        language: 'python',
        code: 'import socket; socket.connect(("8.8.8.8", 80))',
        stdin: '',
      });
    expect(reRes.status).toBe(200);
    expect(reRes.body.data.status).toBe('RE');
    expect(reRes.body.data.stderr).toContain('Network is unreachable');

    // 5. PREMIUM user gets 5s CPU & 512MB RAM
    const premRes = await request(app)
      .post('/api/v1/code/run')
      .set('Authorization', `Bearer ${premiumStudentToken}`)
      .send({
        language: 'java',
        code: 'public class Main { public static void main(String[] a) { System.out.println("Hi"); } }',
        stdin: 'A'.repeat(100_000), // >64KB allowed for PREMIUM
      });
    expect(premRes.status).toBe(200);
    const premPayload = capturedPayloads[capturedPayloads.length - 1];
    expect(premPayload.cpu_time_limit).toBe(5);
    expect(premPayload.memory_limit).toBe(512 * 1024);

    // 6. FREE user >64KB stdin rejected
    const bigStdinFree = await request(app)
      .post('/api/v1/code/run')
      .set('Authorization', `Bearer ${freeStudentToken}`)
      .send({
        language: 'python',
        code: 'print(1)',
        stdin: 'A'.repeat(70_000),
      });
    expect(bigStdinFree.status).toBe(400);
    expect(bigStdinFree.body.error.code).toBe('STDIN_TOO_LARGE');

    // 7. Verify RunLogs saved in DB
    const runLogsCount = await prisma.runLog.count({ where: { userId: freeStudentId } });
    expect(runLogsCount).toBe(4);
  });

  it('Tài khoản FREE chạy lần thứ 31 trong ngày bị chặn HTTP 429 QUOTA_EXCEEDED', async () => {
    const quotaEmail = `quota_code_${Date.now()}@edu.vn`;
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Code Quota 31 Tester',
        email: quotaEmail,
        password: 'password123',
        confirmPassword: 'password123',
        studentId: '20269902',
        university: 'HUST',
        agree: true,
      });
    const token = reg.body.data.accessToken;
    const uid = reg.body.data.user.id;

    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          stdout: b64('ok\n'),
          stderr: null,
          compile_output: null,
          message: null,
          time: '0.010',
          memory: 4096,
          exit_code: 0,
          status: { id: 3, description: 'Accepted' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    try {
      for (let i = 1; i <= 30; i++) {
        const res = await request(app)
          .post('/api/v1/code/run')
          .set('Authorization', `Bearer ${token}`)
          .send({ language: 'python', code: 'print("ok")', stdin: '' });
        expect(res.status).toBe(200);
      }

      const run31 = await request(app)
        .post('/api/v1/code/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ language: 'python', code: 'print("over")', stdin: '' });

      expect(run31.status).toBe(429);
      expect(run31.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(run31.body.error.details.limit).toBe(30);
      expect(run31.body.error.details.used).toBe(31);
    } finally {
      await prisma.user.deleteMany({ where: { id: uid } });
    }
  });

  it('Quản lý Snippets: giới hạn 3 snippets cho FREE, chia sẻ public và xoá snippet', async () => {
    const createdIds: string[] = [];

    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/api/v1/code/snippets')
        .set('Authorization', `Bearer ${freeStudentToken}`)
        .send({
          title: `snippet_${i}.py`,
          language: 'python',
          code: `print(${i})`,
          isPublic: i === 1,
        });
      expect(res.status).toBe(201);
      createdIds.push(res.body.data.id);
    }

    // 4th snippet rejected
    const fourth = await request(app)
      .post('/api/v1/code/snippets')
      .set('Authorization', `Bearer ${freeStudentToken}`)
      .send({
        title: 'snippet_4.py',
        language: 'python',
        code: 'print(4)',
      });
    expect(fourth.status).toBe(403);
    expect(fourth.body.error.code).toBe('SNIPPET_LIMIT_REACHED');

    // Public snippet readable by guest
    const pubGet = await request(app).get(`/api/v1/code/snippets/${createdIds[0]}`);
    expect(pubGet.status).toBe(200);
    expect(pubGet.body.data.title).toBe('snippet_1.py');

    // Private snippet blocked for guest
    const privGet = await request(app).get(`/api/v1/code/snippets/${createdIds[1]}`);
    expect(privGet.status).toBe(403);

    // Delete snippet
    const delRes = await request(app)
      .delete(`/api/v1/code/snippets/${createdIds[0]}`)
      .set('Authorization', `Bearer ${freeStudentToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deleted).toBe(true);
  });
});
