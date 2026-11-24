import type { TopicCode } from '../contracts/events.js';
import type { AiReviewHostPorts, LoggerPort } from '../contracts/ports.js';
import {
  LLMProviderError,
  estimateTokenCount,
  type LLMProvider,
  type LLMUsage,
} from '../llm/types.js';
import {
  QuotaExceededError,
  QuotaServiceUnavailableError,
  type TokenMeteringService,
} from '../quota/index.js';
import type { BuildExamSetResult } from '../recommender/exam-set.builder.js';
import {
  computeRecentlyAttemptedIds,
  computeSpacedReviewCandidates,
  computeTopicMasteries,
} from '../recommender/mastery.js';
import type { RecommenderService } from '../recommender/recommender.service.js';
import type { RoadmapService, RoadmapTopicDto } from '../roadmap/roadmap.service.js';
import type { AuditService } from '../security/audit.service.js';
import type { ExamSetCreatePayload } from '../security/json-schema.js';
import { buildDeterministicReviewSummary } from './fallback.js';
import {
  detectInjectionSignals,
  guardExamRankingOutput,
  guardReviewSummaryOutput,
  type AiReviewSummaryRequestPayload,
  type StudyPlanStepDto,
  type WeaknessInsightDto,
} from './prompt-guard.js';
import {
  buildExamSetRankingPrompt,
  buildReviewSummaryPrompt,
  type CandidateQuestionPromptItem,
} from './prompts.js';

export interface AiReviewSummaryResult {
  generated_at: string;
  source: 'llm' | 'rule_based';
  model_id: string | null;
  fallback_reason: string | null;
  summary: string;
  weakness_insights: WeaknessInsightDto[];
  study_plan: StudyPlanStepDto[];
  weak_topics: TopicCode[];
  recommended_next_topics: TopicCode[];
  recommended_difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  spaced_review_due_count: number;
  recommended_roadmaps: RoadmapTopicDto[];
  usage: LLMUsage | null;
  warnings: string[];
}

export interface AiAssistedExamSetResult extends BuildExamSetResult {
  llm_usage?: LLMUsage | null;
}

export interface AiReviewServiceOptions {
  llmProvider: LLMProvider;
  tokenMetering: TokenMeteringService;
  recommenderService: RecommenderService;
  roadmapService: RoadmapService;
  auditService: AuditService;
  ports: AiReviewHostPorts;
  logger: LoggerPort;
  maxOutputTokens: number;
  nowFn?: () => Date;
}

export class AiReviewService {
  private readonly llmProvider: LLMProvider;
  private readonly tokenMetering: TokenMeteringService;
  private readonly recommenderService: RecommenderService;
  private readonly roadmapService: RoadmapService;
  private readonly auditService: AuditService;
  private readonly ports: AiReviewHostPorts;
  private readonly logger: LoggerPort;
  private readonly maxOutputTokens: number;
  private readonly nowFn: () => Date;

  constructor(options: AiReviewServiceOptions) {
    this.llmProvider = options.llmProvider;
    this.tokenMetering = options.tokenMetering;
    this.recommenderService = options.recommenderService;
    this.roadmapService = options.roadmapService;
    this.auditService = options.auditService;
    this.ports = options.ports;
    this.logger = options.logger;
    this.maxOutputTokens = options.maxOutputTokens;
    this.nowFn = options.nowFn ?? (() => new Date());
  }

  /**
   * Generates a Vietnamese AI weakness summary & roadmap-backed study plan from strictly
   * anonymized learner data. Enforces monthly `llm_tokens` quota (429 when exhausted),
   * `<data untrusted="true">` prompt isolation, strict Ajv + URL + anti-leak output guard,
   * and deterministic rule-based fallback on LLM failure or guard rejection.
   */
  async generateReviewSummary(params: {
    userId: string;
    payload: AiReviewSummaryRequestPayload;
    requestId?: string | null;
  }): Promise<AiReviewSummaryResult> {
    const now = this.nowFn();
    const { userId, payload, requestId } = params;

    const recommendations = await this.recommenderService.getRecommendations(userId);

    const roadmapResolvedTopics = payload.roadmap_topic_ids?.length
      ? await this.roadmapService.resolveReviewedCoreTopics(payload.roadmap_topic_ids)
      : [];
    const focusTopics = [
      ...new Set<TopicCode>([...(payload.topics ?? []), ...roadmapResolvedTopics]),
    ];

    // Load verified ground-truth roadmaps (with 0PL attribution & source_url)
    const roadmapsById = new Map<string, RoadmapTopicDto>();
    if (payload.roadmap_topic_ids?.length) {
      for (const rmId of payload.roadmap_topic_ids.slice(0, 6)) {
        try {
          const item = await this.roadmapService.getTopic(rmId);
          roadmapsById.set(item.id, item);
        } catch {
          // Ignore unknown or malformed roadmap IDs safely
        }
      }
    }
    const topicTargets =
      focusTopics.length > 0 ? focusTopics : recommendations.recommended_next_topics;
    const topicRoadmaps = await this.roadmapService.listRecommendedRoadmapsForTopics(
      topicTargets,
      6
    );
    for (const r of topicRoadmaps) {
      if (!roadmapsById.has(r.id)) {
        roadmapsById.set(r.id, r);
      }
    }
    const roadmaps = [...roadmapsById.values()].slice(0, 8);

    // Record prompt-injection signals (non-PII observability only; structural boundary + output guard always apply)
    const signals = detectInjectionSignals([
      payload.goal,
      ...roadmaps.map((r) => r.title),
      ...roadmaps.map((r) => r.summary),
    ]);
    if (signals.length > 0) {
      await this.auditService.recordSafe({
        actorType: 'student',
        userId,
        action: 'security.prompt_injection_signal',
        resource: 'ai_review_summary',
        outcome: 'ALLOW',
        requestId: requestId ?? null,
        meta: { signals },
      });
    }

    const { systemInstruction, userPrompt } = buildReviewSummaryPrompt({
      recommendations,
      roadmaps,
      goal: payload.goal,
      focusTopics: focusTopics.length > 0 ? focusTopics : undefined,
    });

    const maxOut = Math.min(this.maxOutputTokens, 1024);
    const estimatedTokens = estimateTokenCount(`${systemInstruction}\n${userPrompt}`) + maxOut;

    // Pre-flight monthly `llm_tokens` quota gate (throws QuotaExceededError -> HTTP 429)
    await this.tokenMetering.assertHasBudget(userId, estimatedTokens);

    const allowedRoadmapTopicIds = new Set(roadmaps.map((r) => r.id));
    const allowedGroundTruthUrls = new Set(roadmaps.map((r) => r.source_url));

    const buildFallback = (
      reason: string,
      warningCode: string,
      usage: LLMUsage | null,
      modelId: string | null
    ): AiReviewSummaryResult => {
      const det = buildDeterministicReviewSummary({
        recommendations,
        roadmaps,
        focusTopics: focusTopics.length > 0 ? focusTopics : undefined,
      });
      return {
        generated_at: now.toISOString(),
        source: 'rule_based',
        model_id: modelId,
        fallback_reason: reason,
        summary: det.summary,
        weakness_insights: det.weakness_insights,
        study_plan: det.study_plan,
        weak_topics: recommendations.weak_topics,
        recommended_next_topics: recommendations.recommended_next_topics,
        recommended_difficulty: recommendations.recommended_difficulty,
        spaced_review_due_count: recommendations.spaced_review_due_count,
        recommended_roadmaps: roadmaps,
        usage,
        warnings: [warningCode],
      };
    };

    let llmRes;
    try {
      llmRes = await this.llmProvider.generate({
        systemInstruction,
        userPrompt,
        maxOutputTokens: maxOut,
        temperature: 0.2,
        requestId: requestId ?? undefined,
      });
    } catch (err) {
      const errorCode = err instanceof LLMProviderError ? err.code : 'LLM_UNEXPECTED_ERROR';
      this.logger.warn(
        { errorCode, provider: this.llmProvider.name },
        'LLM summary generation failed; activating deterministic fallback'
      );
      await this.auditService.recordSafe({
        actorType: 'student',
        userId,
        action: 'ai_review.llm_error_fallback',
        resource: 'ai_review_summary',
        outcome: 'ERROR',
        requestId: requestId ?? null,
        meta: { errorCode, provider: this.llmProvider.name },
      });
      return buildFallback(errorCode, 'LLM_FALLBACK_ACTIVATED', null, this.llmProvider.modelId);
    }

    // Meter exact tokens spent at the provider (even if output guard subsequently rejects)
    await this.tokenMetering.recordUsage(userId, {
      inputTokens: llmRes.usage.inputTokens,
      outputTokens: llmRes.usage.outputTokens,
      modelId: llmRes.modelId,
      requestId: requestId ?? undefined,
      latencyMs: llmRes.latencyMs,
    });

    const guarded = guardReviewSummaryOutput(llmRes.text, {
      allowedRoadmapTopicIds,
      allowedGroundTruthUrls,
    });

    if (!guarded.ok) {
      this.logger.warn(
        { reason: guarded.reason, modelId: llmRes.modelId },
        'LLM summary output rejected by guardrails; activating deterministic fallback'
      );
      await this.auditService.recordSafe({
        actorType: 'student',
        userId,
        action: 'ai_review.output_guard_rejected',
        resource: 'ai_review_summary',
        outcome: 'DENY',
        requestId: requestId ?? null,
        meta: { reason: guarded.reason, modelId: llmRes.modelId },
      });
      return buildFallback(
        guarded.reason,
        'LLM_OUTPUT_GUARD_FALLBACK',
        llmRes.usage,
        llmRes.modelId
      );
    }

    await this.auditService.recordSafe({
      actorType: 'student',
      userId,
      action: 'ai_review.summary.generate',
      resource: 'ai_review_summary',
      outcome: 'ALLOW',
      requestId: requestId ?? null,
      meta: {
        source: 'llm',
        modelId: llmRes.modelId,
        inputTokens: llmRes.usage.inputTokens,
        outputTokens: llmRes.usage.outputTokens,
        latencyMs: llmRes.latencyMs,
      },
    });

    return {
      generated_at: now.toISOString(),
      source: 'llm',
      model_id: llmRes.modelId,
      fallback_reason: null,
      summary: guarded.data.summary,
      weakness_insights: guarded.data.weakness_insights,
      study_plan: guarded.data.study_plan,
      weak_topics: recommendations.weak_topics,
      recommended_next_topics: recommendations.recommended_next_topics,
      recommended_difficulty: recommendations.recommended_difficulty,
      spaced_review_due_count: recommendations.spaced_review_due_count,
      recommended_roadmaps: roadmaps,
      usage: llmRes.usage,
      warnings: guarded.warnings,
    };
  }

  /**
   * Builds a personalized 20-question (or custom) MCQ exam set with optional LLM candidate ranking.
   * - Sends ONLY anonymized mastery + lightweight APPROVED candidate metadata (ZERO PII, ZERO answers).
   * - Passes LLM-proposed IDs through ExamSetBuilder's DB APPROVED anti-hallucination filter &
   *   50% hybrid / rule-based fallback threshold.
   */
  async buildAiAssistedExamSet(params: {
    userId: string;
    payload: ExamSetCreatePayload;
    idempotencyKey?: string | null;
    requestId?: string | null;
  }): Promise<AiAssistedExamSetResult> {
    const { userId, payload, idempotencyKey, requestId } = params;

    // When `use_ai` is false/omitted OR caller explicitly supplies `exam_ids`, keep pure Phase 4/5 flow
    if (!payload.use_ai || (payload.exam_ids && payload.exam_ids.length > 0)) {
      return this.recommenderService.createExamSet({
        userId,
        payload,
        idempotencyKey,
        requestId,
        actorType: 'student',
      });
    }

    const now = this.nowFn();
    const roadmapResolvedTopics = payload.roadmap_topic_ids?.length
      ? await this.roadmapService.resolveReviewedCoreTopics(payload.roadmap_topic_ids)
      : [];
    const mergedTopics = [
      ...new Set<TopicCode>([...(payload.topics ?? []), ...roadmapResolvedTopics]),
    ];
    const explicitTopics = mergedTopics.length > 0 ? mergedTopics : undefined;

    const [answers, pool] = await Promise.all([
      this.ports.attemptHistory.listAnswers(userId, { limit: 500 }),
      this.ports.questionPool.findCandidates({ topics: explicitTopics, limit: 500 }),
    ]);

    if (pool.length === 0) {
      return this.recommenderService.createExamSet({
        userId,
        payload,
        idempotencyKey,
        requestId,
        actorType: 'student',
      });
    }

    const estTimeMap = new Map(pool.map((q) => [q.id, q.estimatedTimeSec]));
    const masteries = computeTopicMasteries(answers, now, estTimeMap);
    const weakTopics = masteries
      .filter((m) => m.isWeak)
      .sort((a, b) => b.weakness - a.weakness)
      .map((m) => m.topic);
    const weakSet = new Set(weakTopics);
    const recentSet = computeRecentlyAttemptedIds(answers, now, payload.exclude_recent_days);
    const spacedSet = new Set(
      computeSpacedReviewCandidates(answers, now).map((sc) => sc.questionId)
    );

    // Filter out recently attempted non-spaced questions first so LLM candidates match ExamSetBuilder's
    // eligibility rules and rationale counts stay aligned with the persisted set.
    const eligible = pool.filter((q) => !recentSet.has(q.id) || spacedSet.has(q.id));
    const candidateSource = eligible.length > 0 ? eligible : pool;
    const rankedPool = [...candidateSource].sort((a, b) => {
      const aSpaced = spacedSet.has(a.id) ? 1 : 0;
      const bSpaced = spacedSet.has(b.id) ? 1 : 0;
      if (bSpaced !== aSpaced) return bSpaced - aSpaced;
      const aWeak = weakSet.has(a.topic) ? 1 : 0;
      const bWeak = weakSet.has(b.topic) ? 1 : 0;
      if (bWeak !== aWeak) return bWeak - aWeak;
      return a.id.localeCompare(b.id);
    });

    const maxCandidates = Math.min(60, Math.max(payload.num_questions * 2, 30));
    const promptCandidates: CandidateQuestionPromptItem[] = rankedPool
      .slice(0, maxCandidates)
      .map((q) => ({
        id: q.id,
        topic: q.topic,
        difficulty: q.difficulty,
        tags: q.tags.slice(0, 5),
        estimated_time_sec: q.estimatedTimeSec,
        is_spaced_review: spacedSet.has(q.id),
      }));

    // Detect injection signals in goal (non-PII audit)
    const signals = detectInjectionSignals([payload.goal]);
    if (signals.length > 0) {
      await this.auditService.recordSafe({
        actorType: 'student',
        userId,
        action: 'security.prompt_injection_signal',
        resource: 'exam_set',
        outcome: 'ALLOW',
        requestId: requestId ?? null,
        meta: { signals },
      });
    }

    const { systemInstruction, userPrompt } = buildExamSetRankingPrompt({
      goal: payload.goal,
      requested: payload.num_questions,
      difficulty: payload.difficulty,
      weakTopics,
      candidates: promptCandidates,
    });

    const maxOut = Math.min(this.maxOutputTokens, 768);
    const estimatedTokens = estimateTokenCount(`${systemInstruction}\n${userPrompt}`) + maxOut;

    // Pre-flight monthly token budget check: if exhausted, degrade gracefully to rule-based
    // so the student still gets their exam set (daily exam_sets quota was already consumed by route guard).
    try {
      await this.tokenMetering.assertHasBudget(userId, estimatedTokens);
    } catch (err) {
      if (err instanceof QuotaExceededError || err instanceof QuotaServiceUnavailableError) {
        const fallbackRes = await this.recommenderService.createExamSet({
          userId,
          payload,
          idempotencyKey,
          requestId,
          actorType: 'student',
        });
        return {
          ...fallbackRes,
          warnings: [...fallbackRes.warnings, 'LLM_TOKEN_QUOTA_EXCEEDED_FALLBACK'],
          llm_usage: null,
        };
      }
      throw err;
    }

    let llmRes;
    try {
      llmRes = await this.llmProvider.generate({
        systemInstruction,
        userPrompt,
        maxOutputTokens: maxOut,
        temperature: 0.2,
        requestId: requestId ?? undefined,
      });
    } catch (err) {
      const errorCode = err instanceof LLMProviderError ? err.code : 'LLM_UNEXPECTED_ERROR';
      this.logger.warn(
        { errorCode, provider: this.llmProvider.name },
        'LLM exam-set ranking failed; falling back to deterministic ExamSetBuilder'
      );
      await this.auditService.recordSafe({
        actorType: 'student',
        userId,
        action: 'ai_review.llm_error_fallback',
        resource: 'exam_set',
        outcome: 'ERROR',
        requestId: requestId ?? null,
        meta: { errorCode, provider: this.llmProvider.name },
      });
      const fallbackRes = await this.recommenderService.createExamSet({
        userId,
        payload,
        llmFailed: true,
        modelId: this.llmProvider.modelId,
        idempotencyKey,
        requestId,
        actorType: 'student',
      });
      return { ...fallbackRes, llm_usage: null };
    }

    // Meter exact spent tokens
    await this.tokenMetering.recordUsage(userId, {
      inputTokens: llmRes.usage.inputTokens,
      outputTokens: llmRes.usage.outputTokens,
      modelId: llmRes.modelId,
      requestId: requestId ?? undefined,
      latencyMs: llmRes.latencyMs,
    });

    const guarded = guardExamRankingOutput(llmRes.text);
    if (!guarded.ok) {
      this.logger.warn(
        { reason: guarded.reason, modelId: llmRes.modelId },
        'LLM exam-set ranking rejected by output guard; falling back to deterministic builder'
      );
      await this.auditService.recordSafe({
        actorType: 'student',
        userId,
        action: 'ai_review.output_guard_rejected',
        resource: 'exam_set',
        outcome: 'DENY',
        requestId: requestId ?? null,
        meta: { reason: guarded.reason, modelId: llmRes.modelId },
      });
      const fallbackRes = await this.recommenderService.createExamSet({
        userId,
        payload,
        llmFailed: true,
        modelId: llmRes.modelId,
        idempotencyKey,
        requestId,
        actorType: 'student',
      });
      return {
        ...fallbackRes,
        warnings: [...fallbackRes.warnings, 'LLM_OUTPUT_GUARD_FALLBACK'],
        llm_usage: llmRes.usage,
      };
    }

    const built = await this.recommenderService.createExamSet({
      userId,
      payload,
      llmProposedIds: guarded.data.selected_question_ids,
      modelId: llmRes.modelId,
      rationale: guarded.data.rationale,
      idempotencyKey,
      requestId,
      actorType: 'student',
    });

    return {
      ...built,
      llm_usage: llmRes.usage,
    };
  }
}
