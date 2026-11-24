import type { TopicCode } from '../contracts/events.js';
import type {
  AiReviewHostPorts,
  PlayableQuestion,
  QuestionDifficultyCode,
} from '../contracts/ports.js';
import type { AiReviewPrismaClient } from '../db/client.js';
import type { RoadmapService, RoadmapTopicDto } from '../roadmap/roadmap.service.js';
import type { AuditService } from '../security/audit.service.js';
import type { ExamSetCreatePayload } from '../security/json-schema.js';
import {
  ExamSetBuilder,
  type BuildExamSetResult,
} from './exam-set.builder.js';
import {
  computeSpacedReviewCandidates,
  computeTopicMasteries,
  type TopicMastery,
} from './mastery.js';

export interface RecommendationSummary {
  generated_at: string;
  source: 'rule_based';
  cold_start: boolean;
  total_answers_analyzed: number;
  weak_topics: TopicCode[];
  spaced_review_due_count: number;
  recommended_next_topics: TopicCode[];
  recommended_difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  recommended_roadmaps: RoadmapTopicDto[];
  masteries: TopicMastery[];
}

export class ExamSetNotFoundError extends Error {
  readonly status = 404;
  readonly code = 'EXAM_SET_NOT_FOUND';

  constructor() {
    super('Không tìm thấy bộ đề ôn tập');
    this.name = 'ExamSetNotFoundError';
  }
}

interface MasteryCacheEntry {
  value: RecommendationSummary;
  expiresAtMs: number;
}

const DIFF_TO_LOWER: Record<QuestionDifficultyCode, 'easy' | 'medium' | 'hard'> = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export interface RecommenderServiceOptions {
  prisma: AiReviewPrismaClient;
  ports: AiReviewHostPorts;
  auditService: AuditService;
  roadmapService?: RoadmapService;
  timezone: string;
  nowFn?: () => Date;
  masteryCacheTtlMs?: number;
}

export class RecommenderService {
  private readonly prisma: AiReviewPrismaClient;
  private readonly ports: AiReviewHostPorts;
  private readonly roadmapService?: RoadmapService;
  private readonly nowFn: () => Date;
  private readonly builder: ExamSetBuilder;
  private readonly masteryCache = new Map<string, MasteryCacheEntry>();
  private readonly masteryCacheTtlMs: number;

  constructor(options: RecommenderServiceOptions) {
    this.prisma = options.prisma;
    this.ports = options.ports;
    this.roadmapService = options.roadmapService;
    this.nowFn = options.nowFn ?? (() => new Date());
    this.masteryCacheTtlMs = options.masteryCacheTtlMs ?? 60_000;
    this.builder = new ExamSetBuilder(
      options.prisma,
      options.ports,
      options.auditService,
      options.timezone,
      this.nowFn,
      options.roadmapService
    );
  }

  /**
   * Pure rule-based recommendations (ZERO LLM tokens).
   * Cached briefly per user and invalidated immediately on `attempt.completed`.
   */
  async getRecommendations(userId: string): Promise<RecommendationSummary> {
    const now = this.nowFn();
    const cached = this.masteryCache.get(userId);
    if (cached && cached.expiresAtMs > now.getTime()) {
      return cached.value;
    }

    const [answers, pool] = await Promise.all([
      this.ports.attemptHistory.listAnswers(userId, { limit: 500 }),
      this.ports.questionPool.findCandidates({ limit: 500 }),
    ]);

    const estTimeMap = new Map(pool.map((q) => [q.id, q.estimatedTimeSec]));
    const masteries = computeTopicMasteries(answers, now, estTimeMap);
    const spaced = computeSpacedReviewCandidates(answers, now);

    // Sort weakest-first (practiced weak topics first, then untouched exploration)
    const sorted = [...masteries].sort((a, b) => {
      if (a.isWeak !== b.isWeak) return a.isWeak ? -1 : 1;
      if (b.weakness !== a.weakness) return b.weakness - a.weakness;
      return a.topic.localeCompare(b.topic);
    });

    const weakTopics = sorted.filter((m) => m.isWeak).map((m) => m.topic);
    const recommendedNextTopics =
      weakTopics.length > 0
        ? weakTopics.slice(0, 3)
        : sorted.slice(0, 3).map((m) => m.topic);

    const coldStart = answers.length < 5;
    const avgMastery =
      answers.length === 0
        ? 0.5
        : sorted.reduce((acc, m) => acc + m.mastery, 0) / sorted.length;

    const recommendedDifficulty: RecommendationSummary['recommended_difficulty'] = coldStart
      ? 'easy'
      : avgMastery < 0.5
        ? 'easy'
        : avgMastery <= 0.8
          ? 'adaptive'
          : 'hard';

    const recommendedRoadmaps = this.roadmapService
      ? await this.roadmapService.listRecommendedRoadmapsForTopics(recommendedNextTopics, 5)
      : [];

    const summary: RecommendationSummary = {
      generated_at: now.toISOString(),
      source: 'rule_based',
      cold_start: coldStart,
      total_answers_analyzed: answers.length,
      weak_topics: weakTopics,
      spaced_review_due_count: spaced.length,
      recommended_next_topics: recommendedNextTopics,
      recommended_difficulty: recommendedDifficulty,
      recommended_roadmaps: recommendedRoadmaps,
      masteries: sorted,
    };

    this.masteryCache.set(userId, {
      value: summary,
      expiresAtMs: now.getTime() + this.masteryCacheTtlMs,
    });

    return summary;
  }

  async createExamSet(params: {
    userId: string;
    payload: ExamSetCreatePayload;
    llmProposedIds?: string[];
    llmFailed?: boolean;
    modelId?: string | null;
    rationale?: string | null;
    idempotencyKey?: string | null;
    requestId?: string | null;
    actorType?: 'student' | 'ai_service';
  }): Promise<BuildExamSetResult> {
    return this.builder.buildAndPersist(params);
  }

  async listExamSets(userId: string, limit: number = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const sets = await this.prisma.examSet.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });

    return sets.map((s) => ({
      exam_set_id: s.id,
      goal: s.goal,
      source: s.source,
      requested: s.requested,
      fulfilled: s.fulfilled,
      rejected_count: s.rejectedCount,
      filled_by_fallback: s.filledByFallback,
      status: s.status,
      created_at: s.createdAt.toISOString(),
    }));
  }

  /**
   * Returns an exam set with playable questions (NO correctIndex/explanation).
   * Strictly enforces ownership (anti-IDOR).
   */
  async getExamSetById(userId: string, examSetId: string) {
    const set = await this.prisma.examSet.findFirst({
      where: { id: examSetId, userId },
      include: {
        items: { orderBy: { position: 'asc' } },
      },
    });

    if (!set) {
      throw new ExamSetNotFoundError();
    }

    const qIds = set.items.map((i) => i.questionId);
    const playableList: PlayableQuestion[] = this.ports.questionPool.getPlayableByIds
      ? await this.ports.questionPool.getPlayableByIds(qIds)
      : [];
    const playableMap = new Map(playableList.map((q) => [q.id, q]));

    return {
      exam_set_id: set.id,
      goal: set.goal,
      source: set.source,
      rationale: set.rationale,
      requested: set.requested,
      fulfilled: set.fulfilled,
      rejected_count: set.rejectedCount,
      filled_by_fallback: set.filledByFallback,
      status: set.status,
      created_at: set.createdAt.toISOString(),
      items: set.items.map((item) => {
        const q = playableMap.get(item.questionId);
        return {
          position: item.position,
          question_id: item.questionId,
          topic: item.topic as TopicCode,
          difficulty: DIFF_TO_LOWER[item.difficulty as QuestionDifficultyCode] ?? 'medium',
          reason: item.reasonCode,
          ...(q
            ? {
                level: q.level,
                type: q.type,
                prompt: q.prompt,
                code: q.code,
                options: q.options,
                tags: q.tags,
                estimated_time_sec: q.estimatedTimeSec,
              }
            : {}),
        };
      }),
    };
  }

  invalidateMasteryCache(userId: string): void {
    this.masteryCache.delete(userId);
  }

  clearCache(): void {
    this.masteryCache.clear();
  }

  async handleUserDeleted(userId: string): Promise<void> {
    this.masteryCache.delete(userId);
    await this.prisma.examSet.deleteMany({ where: { userId } });
  }
}
