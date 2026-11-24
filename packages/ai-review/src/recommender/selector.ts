import crypto from 'node:crypto';
import type { TopicCode } from '../contracts/events.js';
import type {
  AttemptAnswerRecord,
  QuestionCandidate,
  QuestionDifficultyCode,
} from '../contracts/ports.js';
import { allocateQuestionSlots } from './allocation.js';
import {
  computeRecentlyAttemptedIds,
  computeSpacedReviewCandidates,
  type TopicMastery,
} from './mastery.js';

export type DifficultyPreference = 'easy' | 'medium' | 'hard' | 'adaptive';

export type SelectionReasonCode =
  | 'WEAK_TOPIC'
  | 'SPACED_REVIEW'
  | 'EXPLORATION'
  | 'USER_TOPIC'
  | 'LLM_PROPOSED';

export interface SelectedQuestionItem {
  question: QuestionCandidate;
  reasonCode: SelectionReasonCode;
}

export interface DeterministicSelectionResult {
  selected: SelectedQuestionItem[];
  warnings: string[];
}

const PREF_TO_DIFF: Record<Exclude<DifficultyPreference, 'adaptive'>, QuestionDifficultyCode> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};

const DIFF_ORDER: Record<QuestionDifficultyCode, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

/**
 * Deterministic tie-breaker in [0, 1e-4) derived from SHA-256(userId:dateKey:questionId).
 * Guarantees identical output for identical inputs without Math.random().
 */
export function deterministicTieBreaker(
  userId: string,
  dateKey: string,
  questionId: string
): number {
  const hex = crypto
    .createHash('sha256')
    .update(`${userId}:${dateKey}:${questionId}`, 'utf8')
    .digest('hex')
    .slice(0, 8);
  return (parseInt(hex, 16) / 0xffffffff) * 1e-4;
}

function difficultyMatchBonus(
  candidateDiff: QuestionDifficultyCode,
  targetDiff: QuestionDifficultyCode
): number {
  const dist = Math.abs(DIFF_ORDER[candidateDiff] - DIFF_ORDER[targetDiff]);
  if (dist === 0) return 0.3;
  if (dist === 1) return 0.1;
  return 0;
}

export interface SelectQuestionsParams {
  userId: string;
  dateKey: string;
  requested: number;
  difficultyPreference: DifficultyPreference;
  explicitTopics?: TopicCode[];
  excludeRecentDays: number;
  now: Date;
  answers: AttemptAnswerRecord[];
  pool: QuestionCandidate[];
  masteries: TopicMastery[];
  alreadyChosenIds?: Set<string>;
}

/**
 * Deterministically selects up to `requested` unique APPROVED questions from `pool`.
 * - Excludes questions answered within `excludeRecentDays` (except eligible SPACED_REVIEW slots).
 * - Never duplicates question IDs; emits `INSUFFICIENT_POOL` warning if pool is smaller than `requested`.
 */
export function selectDeterministicQuestions(
  params: SelectQuestionsParams
): DeterministicSelectionResult {
  const {
    userId,
    dateKey,
    requested,
    difficultyPreference,
    explicitTopics,
    excludeRecentDays,
    now,
    answers,
    pool,
    masteries,
  } = params;

  if (requested <= 0) {
    return { selected: [], warnings: [] };
  }

  const chosenIds = new Set<string>(params.alreadyChosenIds ?? []);
  const selected: SelectedQuestionItem[] = [];
  const masteryByTopic = new Map(masteries.map((m) => [m.topic, m]));
  const explicitSet = explicitTopics?.length ? new Set<TopicCode>(explicitTopics) : null;

  // Map latest answer timestamp per question for mild recency penalty on older attempts
  const lastAnsweredMs = new Map<string, number>();
  for (const a of answers) {
    const t = a.answeredAt.getTime();
    const prev = lastAnsweredMs.get(a.questionId);
    if (prev === undefined || t > prev) {
      lastAnsweredMs.set(a.questionId, t);
    }
  }

  const recentSet = computeRecentlyAttemptedIds(answers, now, excludeRecentDays);
  const spacedCandidates = computeSpacedReviewCandidates(answers, now);

  // Restrict pool to explicit topics if requested
  const scopedPool = explicitSet ? pool.filter((q) => explicitSet.has(q.topic)) : pool;
  const poolById = new Map(scopedPool.map((q) => [q.id, q]));

  // Eligible spaced-review questions present in scoped APPROVED pool and not yet chosen
  const eligibleSpaced = spacedCandidates
    .map((sc) => poolById.get(sc.questionId))
    .filter((q): q is QuestionCandidate => Boolean(q) && !chosenIds.has(q!.id));

  const allocation = allocateQuestionSlots({
    requested,
    masteries,
    explicitTopics,
    spacedReviewAvailable: eligibleSpaced.length,
  });

  const scoreCandidate = (q: QuestionCandidate): number => {
    const m = masteryByTopic.get(q.topic);
    const weakness = m?.weakness ?? 0.5;
    const targetDiff =
      difficultyPreference === 'adaptive'
        ? (m?.recommendedDifficulty ?? 'MEDIUM')
        : PREF_TO_DIFF[difficultyPreference];

    const bonus = difficultyMatchBonus(q.difficulty, targetDiff);
    const prevMs = lastAnsweredMs.get(q.id);
    let recencyPenalty = 0;
    if (prevMs !== undefined) {
      const ageDays = Math.max(0, (now.getTime() - prevMs) / 86_400_000);
      recencyPenalty = 0.2 * Math.exp(-ageDays / 14);
    }

    return weakness + bonus - recencyPenalty + deterministicTieBreaker(userId, dateKey, q.id);
  };

  // 1. Fill SPACED_REVIEW slots (wrong questions >= 3 days old)
  for (const q of eligibleSpaced) {
    if (selected.length >= allocation.spacedReviewSlots) break;
    if (chosenIds.has(q.id)) continue;
    chosenIds.add(q.id);
    selected.push({ question: q, reasonCode: 'SPACED_REVIEW' });
  }

  // Non-recent eligible pool for remaining slots
  const nonRecentPool = scopedPool.filter((q) => !recentSet.has(q.id) && !chosenIds.has(q.id));
  const nonRecentByTopic = new Map<TopicCode, QuestionCandidate[]>();
  for (const q of nonRecentPool) {
    const list = nonRecentByTopic.get(q.topic) ?? [];
    list.push(q);
    nonRecentByTopic.set(q.topic, list);
  }
  for (const list of nonRecentByTopic.values()) {
    list.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  }

  const pickFromTopic = (
    topic: TopicCode,
    count: number,
    reasonCode: SelectionReasonCode
  ): void => {
    const candidates = nonRecentByTopic.get(topic) ?? [];
    let picked = 0;
    for (const q of candidates) {
      if (picked >= count || selected.length >= requested) break;
      if (chosenIds.has(q.id)) continue;
      chosenIds.add(q.id);
      selected.push({ question: q, reasonCode });
      picked += 1;
    }
  };

  // 2. Fill WEAK_TOPIC / USER_TOPIC slots
  const primaryReason: SelectionReasonCode = explicitSet ? 'USER_TOPIC' : 'WEAK_TOPIC';
  const sortedWeakEntries = [...allocation.weakTopicSlots.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  for (const [topic, count] of sortedWeakEntries) {
    pickFromTopic(topic, count, primaryReason);
  }

  // 3. Fill EXPLORATION slots
  const sortedExplEntries = [...allocation.explorationSlots.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  for (const [topic, count] of sortedExplEntries) {
    pickFromTopic(topic, count, 'EXPLORATION');
  }

  // 4. Fill any remaining shortfall from overall non-recent scoped pool sorted deterministically
  if (selected.length < requested) {
    const leftovers = nonRecentPool
      .filter((q) => !chosenIds.has(q.id))
      .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

    for (const q of leftovers) {
      if (selected.length >= requested) break;
      chosenIds.add(q.id);
      selected.push({ question: q, reasonCode: primaryReason });
    }
  }

  const warnings: string[] = [];
  if (selected.length < requested) {
    warnings.push('INSUFFICIENT_POOL');
  }

  return { selected, warnings };
}
