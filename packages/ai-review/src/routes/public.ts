import { Router, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import type { AiReviewConfig } from '../config.js';
import type { TopicCode } from '../contracts/events.js';
import {
  CONTRACT_VERSION,
  type AiReviewHostPorts,
  type AuthenticatedStudentRequest,
  type LoggerPort,
} from '../contracts/ports.js';
import {
  sendQuotaExceededResponse,
  type QuotaAttachedRequest,
} from '../quota/middleware.js';
import {
  QuotaExceededError,
  QuotaServiceUnavailableError,
  type QuotaService,
} from '../quota/quota.service.js';
import {
  ExamSetNotFoundError,
  type RecommenderService,
} from '../recommender/recommender.service.js';
import type {
  AiReviewService,
  AiReviewSummaryRequestPayload,
} from '../review/index.js';
import {
  RoadmapNotFoundError,
  RoadmapValidationError,
  type RoadmapService,
} from '../roadmap/roadmap.service.js';
import {
  rejectStudentOverride,
  toMinimizedAttemptHistoryDto,
  toMinimizedStudentProfileDto,
  type AuditService,
  type ExamSetCreatePayload,
} from '../security/index.js';

export interface ModuleHealthResult {
  status: 'ok' | 'degraded';
  schema: 'ai_review';
  database: 'connected' | 'error';
  contractVersion: number;
  message?: string;
}

export interface PublicRouterDeps {
  config: AiReviewConfig;
  ports: AiReviewHostPorts;
  logger: LoggerPort;
  quotaService: QuotaService;
  auditService: AuditService;
  recommenderService: RecommenderService;
  roadmapService: RoadmapService;
  aiReviewService: AiReviewService;
  rateLimiter: RequestHandler;
  examSetGuardStack: RequestHandler[];
  summaryGuardStack: RequestHandler[];
  health: () => Promise<ModuleHealthResult>;
}

const AttemptsQuerySchema = z.object({
  since: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Tham số since phải là ngày ISO hợp lệ')
    .optional(),
  topic: z.enum(['CTDL', 'OOP', 'CSDL', 'MANG', 'HDH', 'AI_DS', 'WEB_CLOUD']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

function sendOk<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>) {
  return res.status(status).json({
    data,
    error: null,
    ...(meta ? { meta } : {}),
  });
}

function sendFail(res: Response, message: string, status: number, code: string, details?: unknown) {
  return res.status(status).json({
    data: null,
    error: {
      message,
      code,
      status,
      ...(details ? { details } : {}),
    },
  });
}

export function createPublicRouter(deps: PublicRouterDeps): Router {
  const router = Router();
  const {
    config,
    ports,
    logger,
    quotaService,
    auditService,
    recommenderService,
    roadmapService,
    aiReviewService,
    rateLimiter,
    examSetGuardStack,
    summaryGuardStack,
    health,
  } = deps;
  const requireStudent = ports.auth.requireStudent();

  /**
   * Public status endpoint for FE feature-flag probing.
   * Returns 404 when module is disabled (router is not mounted at all).
   */
  router.get('/status', (_req, res) => {
    return sendOk(res, {
      enabled: true,
      module: '@devstudy/ai-review',
      contractVersion: CONTRACT_VERSION,
      provider: config.llmProvider,
      timezone: config.timezone,
      status: 'ok',
    });
  });

  /**
   * Module health endpoint checking isolated `ai_review` schema connectivity.
   */
  router.get('/health', async (_req, res) => {
    const result = await health();
    return res.status(result.status === 'ok' ? 200 : 503).json({
      data: result.status === 'ok' ? result : null,
      error:
        result.status === 'ok'
          ? null
          : {
              message: result.message || 'AI Review database unavailable',
              code: 'AI_REVIEW_UNHEALTHY',
              status: 503,
            },
    });
  });

  /**
   * Phase 1 adapter verification endpoint (STUDENT only).
   * Returns strictly anonymous learning context & real DB subscription — zero PII.
   */
  router.get(
    '/me/context',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'student_context'),
    async (req, res) => {
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent;

      if (!student || student.role !== 'STUDENT') {
        return sendFail(res, 'Chỉ sinh viên (STUDENT) mới được sử dụng tính năng này', 403, 'FORBIDDEN_ROLE');
      }

      try {
        const [summary, subscription] = await Promise.all([
          ports.studentDirectory.getStudentSummary(student.userId),
          ports.planResolver.getPlanSubscription(student.userId),
        ]);

        return sendOk(res, {
          role: student.role,
          plan: {
            code: subscription.planCode,
            startedAt: subscription.startedAt.toISOString(),
            expiresAt: subscription.expiresAt ? subscription.expiresAt.toISOString() : null,
          },
          learningSummary: {
            selfLevel: summary.selfLevel ?? null,
            enrolledCourses: summary.enrolledCourses,
          },
        });
      } catch (err) {
        logger.error({ err }, 'Failed to resolve student context in ai-review');
        return sendFail(res, 'Không thể tải ngữ cảnh học tập', 500, 'CONTEXT_LOAD_ERROR');
      }
    }
  );

  /**
   * Phase 3 — PII-minimized learner profile endpoint (STUDENT only, strictly scoped to session userId).
   */
  router.get(
    '/me/profile',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'student_profile'),
    async (req, res) => {
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent!;
      const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

      try {
        const [summary, subscription] = await Promise.all([
          ports.studentDirectory.getStudentSummary(student.userId),
          ports.planResolver.getPlanSubscription(student.userId),
        ]);

        const dto = toMinimizedStudentProfileDto(summary, subscription);

        await auditService.recordSafe({
          actorType: 'student',
          userId: student.userId,
          action: 'student_profile.read',
          resource: 'student_profile',
          outcome: 'ALLOW',
          requestId: reqId,
          meta: { plan: dto.plan, enrolledCount: dto.enrolled_courses.length },
        });

        return sendOk(res, dto);
      } catch (err) {
        logger.error({ err }, 'Failed to read minimized student profile');
        return sendFail(res, 'Không thể tải hồ sơ học tập', 500, 'PROFILE_LOAD_ERROR');
      }
    }
  );

  /**
   * Phase 3 — PII-minimized attempt history endpoint (STUDENT only, strictly scoped to session userId).
   */
  router.get(
    '/me/attempts',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'attempt_history'),
    async (req, res) => {
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent!;
      const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

      const parsed = AttemptsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendFail(
          res,
          'Tham số lọc lịch sử làm bài không hợp lệ',
          400,
          'VALIDATION_ERROR',
          parsed.error.format()
        );
      }

      try {
        const sinceDate = parsed.data.since ? new Date(parsed.data.since) : undefined;
        const rows = await ports.attemptHistory.listAnswers(student.userId, {
          since: sinceDate,
          topic: parsed.data.topic as TopicCode | undefined,
          limit: parsed.data.limit + 1,
        });

        const hasNext = rows.length > parsed.data.limit;
        const sliced = hasNext ? rows.slice(0, parsed.data.limit) : rows;
        const dto = toMinimizedAttemptHistoryDto(sliced);

        await auditService.recordSafe({
          actorType: 'student',
          userId: student.userId,
          action: 'attempt_history.read',
          resource: 'attempt_history',
          outcome: 'ALLOW',
          requestId: reqId,
          meta: {
            topicFilter: parsed.data.topic ?? 'ALL',
            returnedCount: dto.items.length,
          },
        });

        return sendOk(res, dto, 200, {
          limit: parsed.data.limit,
          hasNext,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to read minimized attempt history');
        return sendFail(res, 'Không thể tải lịch sử làm bài', 500, 'ATTEMPTS_LOAD_ERROR');
      }
    }
  );

  /**
   * Phase 2 — Returns current quota snapshot for the authenticated STUDENT.
   */
  router.get(
    '/quota',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'quota'),
    async (req, res) => {
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent;

      if (!student || student.role !== 'STUDENT') {
        return sendFail(res, 'Chỉ sinh viên (STUDENT) mới được sử dụng tính năng này', 403, 'FORBIDDEN_ROLE');
      }

      try {
        const snapshot = await quotaService.getSnapshot(student.userId);
        return sendOk(res, snapshot);
      } catch (err) {
        logger.error({ err }, 'Failed to fetch quota snapshot in ai-review');
        return sendFail(res, 'Không thể tải thông tin hạn mức', 500, 'QUOTA_LOAD_ERROR');
      }
    }
  );

  /**
   * Phase 4 — Pure rule-based recommendations (ZERO LLM tokens).
   */
  router.get(
    '/recommendations',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'recommendations'),
    async (req, res) => {
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent!;
      try {
        const recommendations = await recommenderService.getRecommendations(student.userId);
        return sendOk(res, recommendations);
      } catch (err) {
        logger.error({ err }, 'Failed to compute recommendations in ai-review');
        return sendFail(res, 'Không thể tính toán gợi ý ôn tập', 500, 'RECOMMENDATIONS_ERROR');
      }
    }
  );

  /**
   * Phase 7 — AI Review weakness summary & roadmap-backed study plan (STUDENT only).
   * Enforces monthly `llm_tokens` quota (429 when exhausted), `<data untrusted="true">` isolation,
   * strict output guardrails, and deterministic rule-based fallback on LLM failure/rejection.
   */
  router.post('/summary', ...summaryGuardStack, async (req, res) => {
    const student = (req as AuthenticatedStudentRequest).aiReviewStudent!;
    const payload = (req.body ?? {}) as AiReviewSummaryRequestPayload;
    const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null;

    try {
      const result = await aiReviewService.generateReviewSummary({
        userId: student.userId,
        payload,
        requestId: reqId,
      });
      return sendOk(res, result, 200);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return sendQuotaExceededResponse(res, err);
      }
      if (err instanceof QuotaServiceUnavailableError) {
        return sendFail(res, err.message, 503, err.code);
      }
      logger.error({ err }, 'Failed to generate AI review summary');
      return sendFail(res, 'Không thể tạo phân tích ôn tập AI', 500, 'AI_REVIEW_SUMMARY_ERROR');
    }
  });

  /**
   * Phase 4 + Phase 7 — Build & persist a personalized 20-question (or custom) MCQ exam set.
   * When `use_ai: true` (and no explicit `exam_ids`), delegates to AiReviewService for LLM ranking
   * with token metering, output guard, DB APPROVED filtering, and deterministic fallback.
   */
  router.post('/exam-sets', ...examSetGuardStack, async (req, res) => {
    const qReq = req as QuotaAttachedRequest;
    const student = qReq.aiReviewStudent!;
    const payload = req.body as ExamSetCreatePayload;
    const reqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null;
    const idempKey =
      typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].trim() : null;

    try {
      const built = await aiReviewService.buildAiAssistedExamSet({
        userId: student.userId,
        payload,
        idempotencyKey: idempKey,
        requestId: reqId,
      });

      const quota = qReq.aiReviewQuota
        ? {
            metric: qReq.aiReviewQuota.metric,
            limit: qReq.aiReviewQuota.limit,
            remaining: qReq.aiReviewQuota.remaining,
            reset_at: qReq.aiReviewQuota.resetAt,
          }
        : undefined;

      return sendOk(
        res,
        {
          ...built,
          ...(quota ? { quota } : {}),
        },
        201
      );
    } catch (err) {
      logger.error({ err }, 'Failed to build personalized exam set');
      return sendFail(res, 'Không thể dựng bộ đề ôn tập', 500, 'EXAM_SET_BUILD_ERROR');
    }
  });

  /**
   * Phase 4 — List student's own personalized exam sets.
   */
  router.get(
    '/exam-sets',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'exam_set'),
    async (req, res) => {
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent!;
      const limitRaw = req.query.limit ? Number(req.query.limit) : 20;
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50) : 20;

      try {
        const sets = await recommenderService.listExamSets(student.userId, limit);
        return sendOk(res, sets, 200, { total: sets.length });
      } catch (err) {
        logger.error({ err }, 'Failed to list exam sets');
        return sendFail(res, 'Không thể tải danh sách bộ đề', 500, 'EXAM_SET_LIST_ERROR');
      }
    }
  );

  /**
   * Phase 4 — Get one personalized exam set with playable questions (owner-only, NO correctIndex/explanation).
   */
  router.get(
    '/exam-sets/:id',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'exam_set'),
    async (req, res) => {
      const student = (req as AuthenticatedStudentRequest).aiReviewStudent!;
      const examSetId = req.params.id as string;

      try {
        const detail = await recommenderService.getExamSetById(student.userId, examSetId);
        return sendOk(res, detail);
      } catch (err) {
        if (err instanceof ExamSetNotFoundError) {
          return sendFail(res, err.message, 404, err.code);
        }
        logger.error({ err }, 'Failed to load exam set detail');
        return sendFail(res, 'Không thể tải chi tiết bộ đề', 500, 'EXAM_SET_DETAIL_ERROR');
      }
    }
  );

  /**
   * Phase 5 — Read-only Roadmap endpoints (STUDENT only, rate-limited, replacing MCP server).
   */
  router.get(
    '/roadmaps',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'roadmap'),
    async (_req, res) => {
      try {
        const roadmaps = await roadmapService.listRoadmaps();
        return sendOk(res, roadmaps, 200, { total: roadmaps.length });
      } catch (err) {
        logger.error({ err }, 'Failed to list roadmaps');
        return sendFail(res, 'Không thể tải danh sách lộ trình', 500, 'ROADMAP_LIST_ERROR');
      }
    }
  );

  router.get(
    '/roadmaps/:slug',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'roadmap'),
    async (req, res) => {
      const slug = req.params.slug as string;
      const depth = req.query.depth ? Number(req.query.depth) : 2;

      try {
        const detail = await roadmapService.getRoadmap(slug, Number.isFinite(depth) ? depth : 2);
        return sendOk(res, detail);
      } catch (err) {
        if (err instanceof RoadmapValidationError) {
          return sendFail(res, err.message, 400, err.code);
        }
        if (err instanceof RoadmapNotFoundError) {
          return sendFail(res, err.message, 404, err.code);
        }
        logger.error({ err }, 'Failed to get roadmap detail');
        return sendFail(res, 'Không thể tải chi tiết lộ trình', 500, 'ROADMAP_GET_ERROR');
      }
    }
  );

  router.get(
    '/roadmap-topics/search',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'roadmap'),
    async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const roadmapSlug = typeof req.query.roadmap === 'string' ? req.query.roadmap : undefined;
      const tagCode = typeof req.query.tag === 'string' ? req.query.tag : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 15;

      try {
        const result = await roadmapService.searchTopics({
          query: q,
          roadmapSlug,
          tagCode,
          limit: Number.isFinite(limit) ? limit : 15,
        });
        return sendOk(res, result);
      } catch (err) {
        if (err instanceof RoadmapValidationError) {
          return sendFail(res, err.message, 400, err.code);
        }
        logger.error({ err }, 'Failed to search roadmap topics');
        return sendFail(res, 'Không thể tìm kiếm chủ đề lộ trình', 500, 'ROADMAP_SEARCH_ERROR');
      }
    }
  );

  router.get(
    '/roadmap-topics/:id',
    requireStudent,
    rateLimiter,
    rejectStudentOverride(auditService, 'roadmap'),
    async (req, res) => {
      const id = req.params.id as string;

      try {
        const topic = await roadmapService.getTopic(id);
        return sendOk(res, topic);
      } catch (err) {
        if (err instanceof RoadmapValidationError) {
          return sendFail(res, err.message, 400, err.code);
        }
        if (err instanceof RoadmapNotFoundError) {
          return sendFail(res, err.message, 404, err.code);
        }
        logger.error({ err }, 'Failed to get roadmap topic');
        return sendFail(res, 'Không thể tải chi tiết chủ đề lộ trình', 500, 'ROADMAP_TOPIC_ERROR');
      }
    }
  );

  return router;
}
