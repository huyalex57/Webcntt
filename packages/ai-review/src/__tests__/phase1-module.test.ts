import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AiReviewConfigError,
  CONTRACT_VERSION,
  ContractVersionMismatchError,
  createAiReviewModule,
  createModuleLogger,
  isAiReviewEnabled,
  loadAiReviewConfig,
  type AiReviewHostPorts,
  type AuthenticatedStudentRequest,
} from '../index.js';

const TEST_AI_REVIEW_DB_URL =
  process.env.AI_REVIEW_DATABASE_URL ||
  'postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=5';

function createStubPorts(overrides: Partial<AiReviewHostPorts> = {}): AiReviewHostPorts {
  const listeners = new Map<string, Set<(payload: any) => void>>();

  return {
    contractVersion: CONTRACT_VERSION,
    auth: {
      requireStudent: () => (req, _res, next) => {
        (req as AuthenticatedStudentRequest).aiReviewStudent = {
          userId: 'stu-test-1',
          role: 'STUDENT',
        };
        next();
      },
    },
    studentDirectory: {
      async getStudentSummary() {
        return {
          selfLevel: 'TRUNG_BINH',
          enrolledCourses: [{ slug: 'ctdl-giai-thuat', progress: 45 }],
        };
      },
    },
    planResolver: {
      async getPlanSubscription() {
        return {
          planCode: 'PREMIUM',
          startedAt: new Date('2026-11-01T00:00:00.000Z'),
          expiresAt: new Date('2027-11-01T00:00:00.000Z'),
        };
      },
    },
    attemptHistory: {
      async listAnswers() {
        return [];
      },
    },
    questionPool: {
      async findCandidates() {
        return [];
      },
      async getByIds() {
        return [];
      },
    },
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
    ...overrides,
  };
}

describe('Phase 1 — @devstudy/ai-review standalone module', () => {
  describe('Independent Env Configuration (fail-fast)', () => {
    it('returns disabled config without requiring any AI_REVIEW_* vars when flag is off', () => {
      expect(isAiReviewEnabled({})).toBe(false);
      expect(isAiReviewEnabled({ AI_REVIEW_ENABLED: 'false' })).toBe(false);

      const cfg = loadAiReviewConfig({});
      expect(cfg.enabled).toBe(false);
      expect(cfg.llmModel).toBe('');
    });

    it('fails fast when enabled with missing DB URL, missing model ID, or non-ai_review schema', () => {
      expect(() =>
        loadAiReviewConfig({
          AI_REVIEW_ENABLED: 'true',
          AI_REVIEW_LLM_PROVIDER: 'fake',
        })
      ).toThrowError(AiReviewConfigError);

      // Must reject public schema to protect core DB
      expect(() =>
        loadAiReviewConfig({
          AI_REVIEW_ENABLED: 'true',
          AI_REVIEW_DATABASE_URL: 'postgresql://app:app@localhost:5432/itlearn?schema=public',
          AI_REVIEW_LLM_PROVIDER: 'fake',
          AI_REVIEW_LLM_MODEL: 'fake-model',
        })
      ).toThrowError(/schema=ai_review/);

      // Must require API key when provider=gemini
      expect(() =>
        loadAiReviewConfig({
          AI_REVIEW_ENABLED: 'true',
          AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
          AI_REVIEW_LLM_PROVIDER: 'gemini',
          AI_REVIEW_LLM_MODEL: 'test-model-from-env',
          AI_REVIEW_LLM_API_KEY: '',
        })
      ).toThrowError(/AI_REVIEW_LLM_API_KEY/);

      // Must reject invalid timezone
      expect(() =>
        loadAiReviewConfig({
          AI_REVIEW_ENABLED: 'true',
          AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
          AI_REVIEW_LLM_PROVIDER: 'fake',
          AI_REVIEW_LLM_MODEL: 'fake-model',
          AI_REVIEW_TIMEZONE: 'Mars/Olympus_Mons',
        })
      ).toThrowError(/IANA timezone/);
    });

    it('loads valid config with fake provider and explicit model from env', () => {
      const cfg = loadAiReviewConfig({
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
        AI_REVIEW_TIMEZONE: 'Asia/Ho_Chi_Minh',
      });
      expect(cfg.enabled).toBe(true);
      expect(cfg.llmProvider).toBe('fake');
      expect(cfg.llmModel).toBe('fake-v1');
      expect(cfg.quotaFailMode).toBe('closed');
    });
  });

  describe('Contract Version & Lifecycle', () => {
    it('rejects host ports with mismatched major contract version', () => {
      const envSource: NodeJS.ProcessEnv = {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
      };

      expect(() =>
        createAiReviewModule({
          ports: createStubPorts({ contractVersion: CONTRACT_VERSION + 1 }),
          envSource,
        })
      ).toThrowError(ContractVersionMismatchError);
    });

    it('starts cleanly on isolated schema ai_review and serves /status, /health, /me/context', async () => {
      const envSource: NodeJS.ProcessEnv = {
        AI_REVIEW_ENABLED: 'true',
        AI_REVIEW_DATABASE_URL: TEST_AI_REVIEW_DB_URL,
        AI_REVIEW_LLM_PROVIDER: 'fake',
        AI_REVIEW_LLM_MODEL: 'fake-v1',
      };

      const mod = createAiReviewModule({
        ports: createStubPorts(),
        envSource,
      });

      await mod.start();
      try {
        const testApp = express();
        testApp.use('/api/v1/ai-review', mod.publicRouter);

        const statusRes = await request(testApp).get('/api/v1/ai-review/status');
        expect(statusRes.status).toBe(200);
        expect(statusRes.body.data).toMatchObject({
          enabled: true,
          module: '@devstudy/ai-review',
          contractVersion: CONTRACT_VERSION,
          provider: 'fake',
          status: 'ok',
        });
        expect(JSON.stringify(statusRes.body)).not.toContain('postgresql://');

        const healthRes = await request(testApp).get('/api/v1/ai-review/health');
        expect(healthRes.status).toBe(200);
        expect(healthRes.body.data).toMatchObject({
          status: 'ok',
          schema: 'ai_review',
          database: 'connected',
        });

        const ctxRes = await request(testApp).get('/api/v1/ai-review/me/context');
        expect(ctxRes.status).toBe(200);
        expect(ctxRes.body.data.role).toBe('STUDENT');
        expect(ctxRes.body.data.plan.code).toBe('PREMIUM');
        expect(ctxRes.body.data.learningSummary.enrolledCourses).toEqual([
          { slug: 'ctdl-giai-thuat', progress: 45 },
        ]);
      } finally {
        await mod.stop();
      }
    });
  });

  describe('Pino Log Redaction (No Token / API Key / PII Leakage)', () => {
    it('redacts authorization headers, tokens, API keys, emails, studentId and message contents', () => {
      const chunks: string[] = [];
      const stream = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk.toString('utf8'));
          cb();
        },
      });

      const log = createModuleLogger({ level: 'info', destination: stream });
      log.info(
        {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.secret.sig',
          token: 'secret-ai-token-123',
          apiKey: 'AIzaSyFakeApiKey999',
          email: 'linh.tt@edu.vn',
          studentId: '20210002',
          req: {
            headers: {
              authorization: 'Bearer eyJHeaderToken',
              'x-goog-api-key': 'AIzaHeaderKey',
              cookie: 'refreshToken=abc123',
            },
          },
          messages: [{ content: 'Sensitive student prompt' }],
          safeField: 'visible-value',
        },
        'redaction test'
      );

      const output = chunks.join('');
      expect(output).toContain('visible-value');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('eyJhbGci');
      expect(output).not.toContain('eyJHeaderToken');
      expect(output).not.toContain('secret-ai-token-123');
      expect(output).not.toContain('AIzaSyFakeApiKey999');
      expect(output).not.toContain('AIzaHeaderKey');
      expect(output).not.toContain('linh.tt@edu.vn');
      expect(output).not.toContain('20210002');
      expect(output).not.toContain('Sensitive student prompt');
    });
  });

  describe('Import Boundary Checker (real repo + deliberate violations)', () => {
    let tmpDir = '';

    beforeAll(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-review-boundary-test-'));
    });

    afterAll(() => {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('passes on the real monorepo with 0 violations and catches all 4 deliberate violation types', async () => {
      const repoRoot = path.resolve(__dirname, '../../../..');
      const checkerPath = path.join(repoRoot, 'scripts', 'check-module-boundaries.mjs');
      const { checkBoundaries } = (await import(checkerPath)) as {
        checkBoundaries: (dir: string) => Array<{ rule: string; file: string; detail: string }>;
      };

      // 1. Real repo must have 0 violations
      expect(checkBoundaries(repoRoot)).toEqual([]);

      // 2. Fixture with deliberate violations of every single rule
      const writeFixture = (relPath: string, content: string) => {
        const full = path.join(tmpDir, relPath);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf8');
      };

      writeFixture(
        'packages/ai-review/src/bad-module.ts',
        `import { prisma } from '../../../apps/api/src/config/prisma.js';\nexport const m = 'gemini-4-medium';\n`
      );
      writeFixture(
        'apps/api/src/modules/auth/bad-core.ts',
        `import { x } from '@devstudy/ai-review';\nimport { y } from '@devstudy/ai-review/src/config.js';\n`
      );

      const violations = checkBoundaries(tmpDir);
      const rules = new Set(violations.map((v) => v.rule));
      expect(rules.has('NO_MODULE_TO_CORE_IMPORT')).toBe(true);
      expect(rules.has('NO_HARDCODED_LLM_MODEL')).toBe(true);
      expect(rules.has('NO_DEEP_MODULE_IMPORT')).toBe(true);
      expect(rules.has('NO_CORE_DIRECT_MODULE_IMPORT')).toBe(true);
    });
  });
});
