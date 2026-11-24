import type { RequestHandler, Router } from 'express';
import {
  loadAiReviewConfig,
  type AiReviewConfig,
} from './config.js';
import {
  CONTRACT_VERSION,
  ContractVersionMismatchError,
  type AiReviewHostPorts,
  type LoggerPort,
} from './contracts/ports.js';
import { createAiReviewPrismaClient, type AiReviewPrismaClient } from './db/client.js';
import { createLlmProvider, type LLMProvider } from './llm/index.js';
import { createModuleLogger } from './logging.js';
import {
  PlanResolverCache,
  QuotaService,
  TokenMeteringService,
  requireQuota,
  type QuotaMetric,
} from './quota/index.js';
import { RecommenderService } from './recommender/recommender.service.js';
import {
  AI_REVIEW_SUMMARY_REQUEST_SCHEMA,
  AiReviewService,
  type AiReviewSummaryRequestPayload,
} from './review/index.js';
import { RoadmapService } from './roadmap/roadmap.service.js';
import { createPublicRouter, type ModuleHealthResult } from './routes/public.js';
import {
  AuditService,
  DEFAULT_IDEMPOTENCY_TTL_MS,
  EXAM_SET_CREATE_SCHEMA,
  IdempotencyService,
  createUserRateLimiter,
  rejectStudentOverride,
  requireIdempotencyKey,
  validateJsonSchemaBody,
  type ExamSetCreatePayload,
} from './security/index.js';

export interface CreateAiReviewModuleOptions {
  ports: AiReviewHostPorts;
  envSource?: NodeJS.ProcessEnv;
  config?: AiReviewConfig;
  logger?: LoggerPort;
  nowFn?: () => Date;
  planCacheTtlMs?: number;
  idempotencyTtlMs?: number;
  llmProvider?: LLMProvider;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface AiReviewModuleInstance {
  readonly contractVersion: number;
  readonly publicRouter: Router;
  readonly quotaService: QuotaService;
  readonly tokenMetering: TokenMeteringService;
  readonly auditService: AuditService;
  readonly idempotencyService: IdempotencyService;
  readonly recommenderService: RecommenderService;
  readonly roadmapService: RoadmapService;
  readonly llmProvider: LLMProvider;
  readonly aiReviewService: AiReviewService;
  requireQuota(metric: QuotaMetric, cost?: number): RequestHandler;
  /**
   * Complete Phase 3 security pipeline for mutating POST /exam-sets:
   * requireStudent -> rateLimit -> rejectStudentOverride -> Ajv JSON Schema -> Idempotency-Key -> Quota.
   */
  createExamSetGuardStack(): RequestHandler[];
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<ModuleHealthResult>;
}

/**
 * Factory creating a self-contained @devstudy/ai-review module instance.
 * Communicates with the host ONLY through `ports` and `events`.
 */
export function createAiReviewModule(
  options: CreateAiReviewModuleOptions
): AiReviewModuleInstance {
  const { ports } = options;

  // Enforce major contract version compatibility
  const hostMajor = Math.floor(ports.contractVersion);
  if (!Number.isFinite(ports.contractVersion) || hostMajor !== CONTRACT_VERSION) {
    throw new ContractVersionMismatchError(ports.contractVersion, CONTRACT_VERSION);
  }

  const config = options.config ?? loadAiReviewConfig(options.envSource);
  if (!config.enabled) {
    throw new Error(
      'createAiReviewModule() called while AI_REVIEW_ENABLED is not "true". Check isAiReviewEnabled() before mounting.'
    );
  }

  const logger: LoggerPort = options.logger ?? createModuleLogger();
  const prisma: AiReviewPrismaClient = createAiReviewPrismaClient(config.databaseUrl);
  const nowFn = options.nowFn ?? (() => new Date());

  const planCache = new PlanResolverCache(
    ports.planResolver,
    options.planCacheTtlMs ?? 60_000,
    nowFn
  );
  const quotaService = new QuotaService({
    prisma,
    planCache,
    logger,
    timezone: config.timezone,
    failMode: config.quotaFailMode,
    nowFn,
  });
  const tokenMetering = new TokenMeteringService(quotaService);
  const auditService = new AuditService(prisma, logger);
  const idempotencyService = new IdempotencyService(
    prisma,
    options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
    nowFn
  );
  const roadmapService = new RoadmapService(prisma);
  const recommenderService = new RecommenderService({
    prisma,
    ports,
    auditService,
    roadmapService,
    timezone: config.timezone,
    nowFn,
  });
  const llmProvider = createLlmProvider(config, {
    provider: options.llmProvider,
    fetchFn: options.fetchFn,
    sleepFn: options.sleepFn,
  });
  const aiReviewService = new AiReviewService({
    llmProvider,
    tokenMetering,
    recommenderService,
    roadmapService,
    auditService,
    ports,
    logger,
    maxOutputTokens: config.llmMaxOutputTokens,
    nowFn,
  });

  const readRateLimiter = createUserRateLimiter({
    keyPrefix: 'ai_review_read',
    windowSeconds: config.rateLimitWindowSec,
    maxRequests: config.rateLimitMax,
    auditService,
    resource: 'ai_review_api',
    nowFn,
  });

  const mutationRateLimiter = createUserRateLimiter({
    keyPrefix: 'ai_review_mutation',
    windowSeconds: config.rateLimitWindowSec,
    maxRequests: Math.max(1, Math.min(config.rateLimitMax, 20)),
    auditService,
    resource: 'exam_set',
    nowFn,
  });

  const unsubscribers: Array<() => void> = [];
  let started = false;

  const health = async (): Promise<ModuleHealthResult> => {
    try {
      await prisma.moduleMeta.count();
      return {
        status: 'ok',
        schema: 'ai_review',
        database: 'connected',
        contractVersion: CONTRACT_VERSION,
      };
    } catch (err) {
      logger.error({ err }, 'ai-review schema health check failed');
      return {
        status: 'degraded',
        schema: 'ai_review',
        database: 'error',
        contractVersion: CONTRACT_VERSION,
        message: err instanceof Error ? err.message : 'Database connection error',
      };
    }
  };

  const createExamSetGuardStack = (): RequestHandler[] => [
    ports.auth.requireStudent(),
    mutationRateLimiter,
    rejectStudentOverride(auditService, 'exam_set'),
    validateJsonSchemaBody<ExamSetCreatePayload>(EXAM_SET_CREATE_SCHEMA, {
      auditService,
      resource: 'exam_set',
    }),
    requireIdempotencyKey({
      service: idempotencyService,
      auditService,
      logger,
      resource: 'exam_set',
    }),
    requireQuota(quotaService, 'exam_sets', 1),
  ];

  const createSummaryGuardStack = (): RequestHandler[] => [
    ports.auth.requireStudent(),
    mutationRateLimiter,
    rejectStudentOverride(auditService, 'ai_review_summary'),
    validateJsonSchemaBody<AiReviewSummaryRequestPayload>(AI_REVIEW_SUMMARY_REQUEST_SCHEMA, {
      auditService,
      resource: 'ai_review_summary',
    }),
  ];

  const publicRouter = createPublicRouter({
    config,
    ports,
    logger,
    quotaService,
    auditService,
    recommenderService,
    roadmapService,
    aiReviewService,
    rateLimiter: readRateLimiter,
    examSetGuardStack: createExamSetGuardStack(),
    summaryGuardStack: createSummaryGuardStack(),
    health,
  });

  const start = async (): Promise<void> => {
    if (started) return;

    await prisma.$connect();

    await prisma.moduleMeta.upsert({
      where: { key: 'contract_version' },
      update: { value: String(CONTRACT_VERSION) },
      create: { key: 'contract_version', value: String(CONTRACT_VERSION) },
    });

    unsubscribers.push(
      ports.eventBus.on('attempt.completed', (payload) => {
        recommenderService.invalidateMasteryCache(payload.userId);
        logger.debug(
          { attemptId: payload.attemptId, topic: payload.topic, score: payload.score },
          'ai-review invalidated mastery cache on attempt.completed'
        );
      }),
      ports.eventBus.on('subscription.changed', (payload) => {
        quotaService.invalidatePlanCache(payload.userId);
        logger.info(
          { oldPlan: payload.oldPlan, newPlan: payload.newPlan },
          'ai-review invalidated plan cache on subscription.changed'
        );
      }),
      ports.eventBus.on('user.deleted', async (payload) => {
        await Promise.all([
          quotaService.handleUserDeleted(payload.userId),
          idempotencyService.clearByUser(payload.userId),
          recommenderService.handleUserDeleted(payload.userId),
        ]);
        logger.info(
          { event: 'user.deleted', at: payload.at },
          'ai-review cleaned up user data on user.deleted'
        );
      })
    );

    started = true;
    logger.info(
      {
        contractVersion: CONTRACT_VERSION,
        provider: config.llmProvider,
        timezone: config.timezone,
        quotaFailMode: config.quotaFailMode,
      },
      '@devstudy/ai-review module started'
    );
  };

  const stop = async (): Promise<void> => {
    while (unsubscribers.length > 0) {
      const unsub = unsubscribers.pop();
      unsub?.();
    }
    planCache.clear();
    recommenderService.clearCache();
    started = false;
    await prisma.$disconnect();
    logger.info({}, '@devstudy/ai-review module stopped');
  };

  return {
    contractVersion: CONTRACT_VERSION,
    publicRouter,
    quotaService,
    tokenMetering,
    auditService,
    idempotencyService,
    recommenderService,
    roadmapService,
    llmProvider,
    aiReviewService,
    requireQuota: (metric: QuotaMetric, cost: number = 1) =>
      requireQuota(quotaService, metric, cost),
    createExamSetGuardStack,
    start,
    stop,
    health,
  };
}
