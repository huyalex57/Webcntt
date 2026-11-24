import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@ai-review/prisma-client';
import {
  ALL_TOPICS,
  CONTRACT_VERSION,
  MAX_ROADMAP_OUTPUT_BYTES,
  RoadmapValidationError,
  createAiReviewModule,
  type AiReviewHostPorts,
  type AuthenticatedStudentRequest,
  type PlayableQuestion,
  type TopicCode,
} from '../index.js';

const TEST_AI_REVIEW_DB_URL =
  process.env.AI_REVIEW_DATABASE_URL ||
  'postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=10';

const repoRoot = path.resolve(__dirname, '../../../..');

function buildPool(): PlayableQuestion[] {
  const out: PlayableQuestion[] = [];
  for (const topic of ALL_TOPICS) {
    for (let i = 1; i <= 15; i++) {
      out.push({
        id: `q-${topic.toLowerCase()}-${i}`,
        topic,
        level: 'TRUNG_BINH',
        type: 'MCQ',
        difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY',
        tags: [topic.toLowerCase()],
        estimatedTimeSec: 45,
        prompt: `Prompt ${topic} #${i}`,
        code: null,
        options: ['A', 'B', 'C', 'D'],
      });
    }
  }
  return out;
}

describe('Phase 5 — Roadmap Ingest (0PL pinned commit) & Read-Only RoadmapService', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_AI_REVIEW_DB_URL } },
  });
  const testPrefix = `p5_rm_${Date.now()}`;
  const fixtureRepoUrl = `https://example.invalid/${testPrefix}/fixture-roadmaps.git`;
  const createdUserIds: string[] = [];
  let tmpDir = '';

  const trackUser = (suffix: string) => {
    const id = `${testPrefix}_${suffix}`;
    createdUserIds.push(id);
    return id;
  };

  beforeAll(async () => {
    await prisma.$connect();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-review-p5-ingest-'));
  });

  afterAll(async () => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    await prisma.roadmapSource.deleteMany({ where: { repoUrl: fixtureRepoUrl } });
    if (createdUserIds.length > 0) {
      await prisma.examSet.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.idempotencyKey.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.usageEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.usageCounter.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('ingest fixture: refuses LICENSE change & SHA mismatch, is idempotent, and soft-deprecates removed topics while keeping IDs stable', async () => {
    const ingestMod = await import(path.join(repoRoot, 'scripts/roadmap-ingest/ingest.ts'));
    const parseMod = await import(path.join(repoRoot, 'scripts/roadmap-ingest/parse.ts'));

    const fixtureRepo = path.join(tmpDir, 'repo');
    fs.mkdirSync(fixtureRepo, { recursive: true });

    const runGit = (args: string[]) =>
      execFileSync('git', args, {
        cwd: fixtureRepo,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 'test@example.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 'test@example.com',
        },
      }).trim();

    runGit(['init', '--quiet']);
    const licenseText = 'ZERO PUBLIC LICENSE v1.0 Fixture';
    const expectedLicenseSha = parseMod.sha256Hex(licenseText);
    fs.writeFileSync(path.join(fixtureRepo, 'LICENSE'), licenseText, 'utf8');
    fs.writeFileSync(
      path.join(fixtureRepo, 'README.md'),
      [
        '# Fixture Roadmaps',
        '',
        '## Fixture Databases',
        '- [PostgreSQL Mastery](https://example.org/pg) - Deep guide covering indexing, transactions, and query planning. <img alt="Year 2026" src="https://img.shields.io/badge/Year-2026-green">',
        '- [Legacy NoSQL](https://example.org/nosql) - Older path covering document stores and sharding.',
      ].join('\n'),
      'utf8'
    );
    runGit(['add', '.']);
    runGit(['commit', '--quiet', '-m', 'v1']);
    const shaV1 = runGit(['rev-parse', 'HEAD']);

    const configPath = path.join(tmpDir, 'config.json');
    const writeConfig = (sha: string, licSha: string) => {
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          repoUrl: fixtureRepoUrl,
          webUrl: `https://example.invalid/${testPrefix}/fixture-roadmaps`,
          commitSha: sha,
          readmeFile: 'README.md',
          licenseFile: 'LICENSE',
          licenseName: '0PL-1.0',
          licenseOption: 'C',
          expectedLicenseSha256: licSha,
          attribution: 'Fixture Roadmaps (0PL)',
          allowedSections: ['fixture-databases'],
        }),
        'utf8'
      );
    };

    // 1. Commit SHA mismatch -> must FAIL
    writeConfig('0'.repeat(40), expectedLicenseSha);
    await expect(
      ingestMod.runIngest({ configPath, localRepoDir: fixtureRepo, parseOnly: true })
    ).rejects.toThrow(/commit SHA mismatch/i);

    // 2. LICENSE changed -> must FAIL
    writeConfig(shaV1, 'f'.repeat(64));
    await expect(
      ingestMod.runIngest({ configPath, localRepoDir: fixtureRepo, parseOnly: true })
    ).rejects.toThrow(/License SHA-256 mismatch/i);

    // 3. Valid v1 ingest twice -> idempotent, stable IDs, badges stripped, subtopics created
    writeConfig(shaV1, expectedLicenseSha);
    const csvPath = path.join(tmpDir, 'reviewed.csv');
    fs.writeFileSync(
      csvPath,
      'topic_id,tag_code,weight,origin,reviewed_by\nrm:fixture-databases:postgresql-mastery,CSDL,1.0,manual,reviewer-1\n',
      'utf8'
    );

    const run1 = await ingestMod.runIngest({
      configPath,
      localRepoDir: fixtureRepo,
      reviewedCsvPath: csvPath,
      prismaClient: prisma,
    });
    const run2 = await ingestMod.runIngest({
      configPath,
      localRepoDir: fixtureRepo,
      reviewedCsvPath: csvPath,
      prismaClient: prisma,
    });

    expect(run1.snapshot.snapshotChecksum).toBe(run2.snapshot.snapshotChecksum);
    expect(run1.loadResult.roadmapsUpserted).toBe(1);
    expect(run2.loadResult.topicsDeprecated).toBe(0);

    const pgNode = await prisma.roadmapTopic.findUnique({
      where: { id: 'rm:fixture-databases:postgresql-mastery' },
      include: { children: true, tagMaps: true },
    });
    expect(pgNode).not.toBeNull();
    expect(pgNode!.summary).not.toContain('<img');
    expect(pgNode!.year).toBe(2026);
    expect(pgNode!.children.length).toBeGreaterThanOrEqual(3); // indexing, transactions, query planning
    expect(pgNode!.tagMaps.some((m) => m.tagCode === 'CSDL' && m.reviewedBy === 'reviewer-1')).toBe(true);

    // 4. v2 removes Legacy NoSQL -> soft-deprecated (NOT hard-deleted), PostgreSQL ID remains stable!
    fs.writeFileSync(
      path.join(fixtureRepo, 'README.md'),
      [
        '# Fixture Roadmaps',
        '',
        '## Fixture Databases',
        '- [PostgreSQL Mastery](https://example.org/pg) - Deep guide covering indexing, transactions, and query planning.',
      ].join('\n'),
      'utf8'
    );
    runGit(['add', '.']);
    runGit(['commit', '--quiet', '-m', 'v2']);
    const shaV2 = runGit(['rev-parse', 'HEAD']);
    writeConfig(shaV2, expectedLicenseSha);

    const runV2 = await ingestMod.runIngest({
      configPath,
      localRepoDir: fixtureRepo,
      reviewedCsvPath: csvPath,
      prismaClient: prisma,
    });
    expect(runV2.loadResult.topicsDeprecated).toBeGreaterThanOrEqual(1);

    const legacy = await prisma.roadmapTopic.findUnique({
      where: { id: 'rm:fixture-databases:legacy-nosql' },
    });
    expect(legacy).not.toBeNull();
    expect(legacy!.deprecatedAt).not.toBeNull();

    const pgAfterV2 = await prisma.roadmapTopic.findUnique({
      where: { id: 'rm:fixture-databases:postgresql-mastery' },
    });
    expect(pgAfterV2!.deprecatedAt).toBeNull();

    // Clean up fixture source immediately so subsequent tests only inspect real awesome-roadmaps data
    await prisma.roadmapSource.deleteMany({ where: { repoUrl: fixtureRepoUrl } });
  });

  it('real ingested awesome-roadmaps DB has >= 80% reviewed mapping coverage across ingested top-level topics', async () => {
    const activeTopLevel = await prisma.roadmapTopic.findMany({
      where: {
        deprecatedAt: null,
        parentId: null,
        roadmap: {
          deprecatedAt: null,
          source: { repoUrl: 'https://github.com/liuchong/awesome-roadmaps.git' },
        },
      },
      include: {
        tagMaps: { where: { reviewedAt: { not: null } } },
      },
    });

    expect(activeTopLevel.length).toBeGreaterThanOrEqual(70);
    const mappedCount = activeTopLevel.filter((t) => t.tagMaps.length > 0).length;
    const ratio = mappedCount / activeTopLevel.length;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
  });

  it('read-only RoadmapService & HTTP endpoints enforce input validation, 16KB cap, attribution, and link roadmap_topic_ids to 20-Q exam-sets', async () => {
    const userId = trackUser('roadmap_http');
    const pool = buildPool();
    const poolMap = new Map(pool.map((q) => [q.id, q]));

    const ports: AiReviewHostPorts = {
      contractVersion: CONTRACT_VERSION,
      auth: {
        requireStudent: () => (req, _res, next) => {
          (req as AuthenticatedStudentRequest).aiReviewStudent = {
            userId,
            role: 'STUDENT',
          };
          next();
        },
      },
      studentDirectory: { async getStudentSummary() { return { enrolledCourses: [] }; } },
      planResolver: {
        async getPlanSubscription() {
          return { planCode: 'PREMIUM', startedAt: new Date('2026-11-01T00:00:00.000Z'), expiresAt: null };
        },
      },
      attemptHistory: { async listAnswers() { return []; } },
      questionPool: {
        async findCandidates(filter) {
          let list = pool;
          if (filter?.topics?.length) {
            const set = new Set<TopicCode>(filter.topics);
            list = list.filter((q) => set.has(q.topic));
          }
          return list.slice(0, filter?.limit ?? 500);
        },
        async getByIds(ids) {
          return ids.map((id) => poolMap.get(id)).filter((q): q is PlayableQuestion => Boolean(q));
        },
        async getPlayableByIds(ids) {
          return ids.map((id) => poolMap.get(id)).filter((q): q is PlayableQuestion => Boolean(q));
        },
      },
      eventBus: { emit() {}, on() { return () => {}; } },
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
    });
    await mod.start();

    try {
      const app = express();
      app.use(express.json());
      app.use('/api/v1/ai-review', mod.publicRouter);

      // 1. listRoadmaps
      const listRes = await request(app).get('/api/v1/ai-review/roadmaps');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(9);
      const webSummary = listRes.body.data.find((r: any) => r.slug === 'web-development');
      expect(webSummary).toBeDefined();
      expect(webSummary.attribution).toContain('awesome-roadmaps');
      expect(webSummary.license).toContain('0PL');

      // 2. getRoadmap + 16KB output cap respected
      const webRes = await request(app).get('/api/v1/ai-review/roadmaps/web-development');
      expect(webRes.status).toBe(200);
      expect(webRes.body.data.slug).toBe('web-development');
      expect(webRes.body.data.topics.length).toBeGreaterThan(0);
      expect(Buffer.byteLength(JSON.stringify(webRes.body.data), 'utf8')).toBeLessThanOrEqual(
        MAX_ROADMAP_OUTPUT_BYTES + 1024
      );

      // 3. searchTopics
      const searchRes = await request(app).get('/api/v1/ai-review/roadmap-topics/search?q=SQL&tag=CSDL');
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.items.some((i: any) => i.id === 'rm:articles-books:sql-roadmap')).toBe(
        true
      );

      // 4. getTopic
      const topicRes = await request(app).get(
        '/api/v1/ai-review/roadmap-topics/rm:articles-books:sql-roadmap'
      );
      expect(topicRes.status).toBe(200);
      expect(topicRes.body.data.related_tags).toContain('CSDL');
      expect(topicRes.body.data.source_url).toMatch(/^https?:\/\//);
      expect(topicRes.body.data.attribution).toContain('Zero Public License');

      // 5. Path traversal & malformed IDs rejected (400)
      await expect(mod.roadmapService.getRoadmap('../../etc/passwd')).rejects.toBeInstanceOf(
        RoadmapValidationError
      );
      await expect(mod.roadmapService.getTopic('rm:web:../../etc/passwd')).rejects.toBeInstanceOf(
        RoadmapValidationError
      );
      const badSlugRes = await request(app).get('/api/v1/ai-review/roadmaps/INVALID_UPPER!');
      expect(badSlugRes.status).toBe(400);
      expect(badSlugRes.body.error.code).toBe('INVALID_ROADMAP_SLUG');

      const badSearch = await request(app).get('/api/v1/ai-review/roadmap-topics/search?q=');
      expect(badSearch.status).toBe(400);

      // 6. POST /exam-sets using ONLY roadmap_topic_ids -> resolves reviewed CSDL mapping & selects CSDL questions!
      const setRes = await request(app)
        .post('/api/v1/ai-review/exam-sets')
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          goal: 'Ôn tập theo lộ trình SQL Roadmap',
          roadmap_topic_ids: ['rm:articles-books:sql-roadmap'],
          num_questions: 10,
        });
      expect(setRes.status).toBe(201);
      expect(setRes.body.data.fulfilled).toBe(10);
      expect(setRes.body.data.items.every((i: any) => i.topic === 'CSDL')).toBe(true);

      // 7. GET /recommendations includes recommended_roadmaps with attribution
      const recRes = await request(app).get('/api/v1/ai-review/recommendations');
      expect(recRes.status).toBe(200);
      expect(Array.isArray(recRes.body.data.recommended_roadmaps)).toBe(true);
      expect(recRes.body.data.recommended_roadmaps.length).toBeGreaterThan(0);
      expect(recRes.body.data.recommended_roadmaps[0].attribution).toContain('Zero Public License');
    } finally {
      await mod.stop();
    }
  });
});
