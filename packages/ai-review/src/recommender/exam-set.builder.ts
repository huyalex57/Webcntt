import type { Prisma } from '@ai-review/prisma-client';
import type { TopicCode } from '../contracts/events.js';
import type {
  AiReviewHostPorts,
  QuestionCandidate,
} from '../contracts/ports.js';
import type { AiReviewPrismaClient } from '../db/client.js';
import { computeDailyPeriod } from '../quota/period.js';
import type { RoadmapService } from '../roadmap/roadmap.service.js';
import type { AuditService } from '../security/audit.service.js';
import type { ExamSetCreatePayload } from '../security/json-schema.js';
import {
  computeRecentlyAttemptedIds,
  computeSpacedReviewCandidates,
  computeTopicMasteries,
} from './mastery.js';
import {
  selectDeterministicQuestions,
  type SelectedQuestionItem,
} from './selector.js';

export type ExamSetSource = 'llm' | 'hybrid' | 'rule_based';

export type RejectedIdReason =
  | 'NOT_FOUND'
  | 'NOT_IN_POOL'
  | 'RECENTLY_ATTEMPTED'
  | 'DUPLICATE'
  | 'OVER_LIMIT';

export interface RejectedIdEntry {
  id: string;
  reason: RejectedIdReason;
}

export interface BuiltExamSetItemDto {
  position: number;
  question_id: string;
  topic: TopicCode;
  difficulty: 'easy' | 'medium' | 'hard';
  reason: string;
}

export interface BuildExamSetResult {
  exam_set_id: string;
  source: ExamSetSource;
  model_id: string | null;
  rationale: string | null;
  requested: number;
  fulfilled: number;
  items: BuiltExamSetItemDto[];
  rejected_ids: RejectedIdEntry[];
  filled_by_fallback: number;
  warnings: string[];
  created_at: string;
}

export interface BuildExamSetParams {
  userId: string;
  payload: ExamSetCreatePayload;
  llmProposedIds?: string[];
  llmFailed?: boolean;
  modelId?: string | null;
  rationale?: string | null;
  idempotencyKey?: string | null;
  requestId?: string | null;
  actorType?: 'student' | 'ai_service';
}

const DIFF_TO_LOWER: Record<QuestionCandidate['difficulty'], 'easy' | 'medium' | 'hard'> = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export class ExamSetBuilder {
  constructor(
    private readonly prisma: AiReviewPrismaClient,
    private readonly ports: AiReviewHostPorts,
    private readonly auditService: AuditService,
    private readonly timezone: string,
    private readonly nowFn: () => Date = () => new Date(),
    private readonly roadmapService?: RoadmapService
  ) {}

  async buildAndPersist(params: BuildExamSetParams): Promise<BuildExamSetResult> {
    const now = this.nowFn();
    const { payload, userId } = params;
    const requested = payload.num_questions;
    const excludeRecentDays = payload.exclude_recent_days;
    const roadmapResolvedTopics =
      payload.roadmap_topic_ids?.length && this.roadmapService
        ? await this.roadmapService.resolveReviewedCoreTopics(payload.roadmap_topic_ids)
        : [];
    const mergedTopics = [
      ...new Set<TopicCode>([...(payload.topics ?? []), ...roadmapResolvedTopics]),
    ];
    const explicitTopics = mergedTopics.length > 0 ? mergedTopics : undefined;
    const dateKey = computeDailyPeriod(now, this.timezone).periodKey;

    // 1. Load student's history & APPROVED candidate pool in parallel
    const [answers, pool] = await Promise.all([
      this.ports.attemptHistory.listAnswers(userId, { limit: 500 }),
      this.ports.questionPool.findCandidates({
        topics: explicitTopics,
        limit: 500,
      }),
    ]);

    const estTimeMap = new Map(pool.map((q) => [q.id, q.estimatedTimeSec]));
    const masteries = computeTopicMasteries(answers, now, estTimeMap);
    const recentSet = computeRecentlyAttemptedIds(answers, now, excludeRecentDays);
    const spacedSet = new Set(
      computeSpacedReviewCandidates(answers, now).map((sc) => sc.questionId)
    );

    // 2. Validate proposed IDs (from LLM or request exam_ids) against APPROVED pool (anti-hallucination)
    const rawProposed = params.llmProposedIds ?? payload.exam_ids ?? [];
    const rejectedIds: RejectedIdEntry[] = [];
    const validProposed: SelectedQuestionItem[] = [];

    if (!params.llmFailed && rawProposed.length > 0) {
      const approvedList = await this.ports.questionPool.getByIds(rawProposed);
      const approvedById = new Map(approvedList.map((q) => [q.id, q]));
      const explicitSet = explicitTopics ? new Set(explicitTopics) : null;
      const seen = new Set<string>();

      for (const rawId of rawProposed) {
        if (seen.has(rawId)) {
          rejectedIds.push({ id: rawId, reason: 'DUPLICATE' });
          continue;
        }
        seen.add(rawId);

        const q = approvedById.get(rawId);
        if (!q) {
          rejectedIds.push({ id: rawId, reason: 'NOT_FOUND' });
          continue;
        }
        if (explicitSet && !explicitSet.has(q.topic)) {
          rejectedIds.push({ id: rawId, reason: 'NOT_IN_POOL' });
          continue;
        }
        if (recentSet.has(q.id) && !spacedSet.has(q.id)) {
          rejectedIds.push({ id: rawId, reason: 'RECENTLY_ATTEMPTED' });
          continue;
        }
        if (validProposed.length >= requested) {
          rejectedIds.push({ id: rawId, reason: 'OVER_LIMIT' });
          continue;
        }

        validProposed.push({ question: q, reasonCode: 'LLM_PROPOSED' });
      }
    }

    // 3. Apply fallback rule:
    //    - LLM failed OR no proposed IDs OR valid proposed < 50% of requested -> full rule-based fallback
    //    - valid proposed in [50%, 100%) -> hybrid (keep valid + fill remaining deterministically)
    //    - valid proposed === requested -> pure llm
    const minValidForHybrid = Math.ceil(requested * 0.5);
    let source: ExamSetSource;
    let finalSelection: SelectedQuestionItem[];
    let filledByFallback = 0;
    const warnings: string[] = [];

    if (params.llmFailed || rawProposed.length === 0 || validProposed.length < minValidForHybrid) {
      source = 'rule_based';
      if (params.llmFailed) {
        warnings.push('LLM_FALLBACK_ACTIVATED');
      } else if (rawProposed.length > 0 && validProposed.length < minValidForHybrid) {
        warnings.push('PROPOSED_IDS_BELOW_THRESHOLD_FALLBACK');
      }
      const fallback = selectDeterministicQuestions({
        userId,
        dateKey,
        requested,
        difficultyPreference: payload.difficulty,
        explicitTopics,
        excludeRecentDays,
        now,
        answers,
        pool,
        masteries,
      });
      finalSelection = fallback.selected;
      filledByFallback = fallback.selected.length;
      warnings.push(...fallback.warnings);
    } else if (validProposed.length < requested) {
      source = 'hybrid';
      const remainingNeeded = requested - validProposed.length;
      const alreadyChosenIds = new Set(validProposed.map((item) => item.question.id));
      const fill = selectDeterministicQuestions({
        userId,
        dateKey,
        requested: remainingNeeded,
        difficultyPreference: payload.difficulty,
        explicitTopics,
        excludeRecentDays,
        now,
        answers,
        pool,
        masteries,
        alreadyChosenIds,
      });
      finalSelection = [...validProposed, ...fill.selected];
      filledByFallback = fill.selected.length;
      warnings.push(...fill.warnings);
    } else {
      source = 'llm';
      finalSelection = validProposed;
      filledByFallback = 0;
    }

    if (finalSelection.length < requested && !warnings.includes('INSUFFICIENT_POOL')) {
      warnings.push('INSUFFICIENT_POOL');
    }

    // 4. Persist ExamSet + ExamSetItems atomically in schema `ai_review`
    const storedParams: Prisma.InputJsonValue = {
      topics: explicitTopics ?? null,
      roadmap_topic_ids: payload.roadmap_topic_ids ?? null,
      difficulty: payload.difficulty,
      exclude_recent_days: excludeRecentDays,
    };

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.examSet.create({
        data: {
          userId,
          goal: payload.goal,
          params: storedParams,
          source,
          modelId: params.modelId ?? null,
          rationale: params.rationale ?? payload.rationale ?? null,
          requested,
          fulfilled: finalSelection.length,
          rejectedCount: rejectedIds.length,
          filledByFallback,
          status: 'CREATED',
          idempotencyKey: params.idempotencyKey ?? null,
          items: {
            create: finalSelection.map((item, idx) => ({
              position: idx + 1,
              questionId: item.question.id,
              topic: item.question.topic,
              difficulty: item.question.difficulty,
              reasonCode: item.reasonCode,
            })),
          },
        },
        include: {
          items: { orderBy: { position: 'asc' } },
        },
      });
    });

    // 5. Emit module event & record non-PII audit event
    this.ports.eventBus.emit('ai_review.exam_set.created', {
      userId,
      examSetId: created.id,
      questionIds: created.items.map((i) => i.questionId),
      createdAt: created.createdAt.toISOString(),
    });

    await this.auditService.recordSafe({
      actorType: params.actorType ?? 'student',
      userId,
      action: 'exam_set.create',
      resource: 'exam_set',
      resourceId: created.id,
      outcome: 'ALLOW',
      requestId: params.requestId ?? null,
      meta: {
        source,
        requested,
        fulfilled: created.fulfilled,
        rejectedCount: rejectedIds.length,
        filledByFallback,
      },
    });

    return {
      exam_set_id: created.id,
      source,
      model_id: created.modelId,
      rationale: created.rationale,
      requested: created.requested,
      fulfilled: created.fulfilled,
      items: created.items.map((i) => ({
        position: i.position,
        question_id: i.questionId,
        topic: i.topic as TopicCode,
        difficulty: DIFF_TO_LOWER[i.difficulty as QuestionCandidate['difficulty']] ?? 'medium',
        reason: i.reasonCode,
      })),
      rejected_ids: rejectedIds,
      filled_by_fallback: filledByFallback,
      warnings,
      created_at: created.createdAt.toISOString(),
    };
  }
}
