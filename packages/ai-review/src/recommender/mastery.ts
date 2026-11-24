import type { TopicCode } from '../contracts/events.js';
import type {
  AttemptAnswerRecord,
  QuestionDifficultyCode,
} from '../contracts/ports.js';

export const ALL_TOPICS: readonly TopicCode[] = [
  'CTDL',
  'OOP',
  'CSDL',
  'MANG',
  'HDH',
  'AI_DS',
  'WEB_CLOUD',
] as const;

export const MASTERY_HALF_LIFE_DAYS = 14;
export const MASTERY_DECAY_LAMBDA = Math.LN2 / MASTERY_HALF_LIFE_DAYS;
export const MASTERY_PRIOR_ALPHA = 2;
export const MASTERY_PRIOR_P0 = 0.6;
export const SLOW_ANSWER_MULTIPLIER = 2;
export const DEFAULT_REF_TIME_MS = 45_000;
export const SPACED_REVIEW_MIN_AGE_DAYS = 3;

const CORRECT_DIFFICULTY_WEIGHT: Record<QuestionDifficultyCode, number> = {
  EASY: 0.8,
  MEDIUM: 1.0,
  HARD: 1.2,
};

const WRONG_DIFFICULTY_WEIGHT: Record<QuestionDifficultyCode, number> = {
  EASY: 1.2,
  MEDIUM: 1.0,
  HARD: 0.8,
};

export type ConfidenceLabel = 'none' | 'low' | 'medium' | 'high';

export interface TopicMastery {
  topic: TopicCode;
  mastery: number; // 0..1
  weakness: number; // 1 - mastery (0.5 when no attempts)
  confidence: number; // sum(w_i)
  confidenceLabel: ConfidenceLabel;
  answered: number;
  correct: number;
  rawAccuracy: number | null; // 0..1 or null if answered=0
  isWeak: boolean;
  recommendedDifficulty: QuestionDifficultyCode;
}

export interface SpacedReviewCandidate {
  questionId: string;
  topic: TopicCode;
  difficulty: QuestionDifficultyCode;
  lastAnsweredAt: Date;
  ageDays: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classifyConfidence(weightSum: number): ConfidenceLabel {
  if (weightSum <= 0) return 'none';
  if (weightSum < 3) return 'low';
  if (weightSum < 8) return 'medium';
  return 'high';
}

export function targetDifficultyForMastery(mastery: number): QuestionDifficultyCode {
  if (mastery < 0.5) return 'EASY';
  if (mastery <= 0.8) return 'MEDIUM';
  return 'HARD';
}

/**
 * Computes time-decayed, difficulty-weighted Bayesian topic mastery from student attempt history.
 */
export function computeTopicMasteries(
  answers: AttemptAnswerRecord[],
  now: Date,
  estimatedTimeByQuestion?: Map<string, number>
): TopicMastery[] {
  // Compute median reference time per question (when >= 3 samples exist)
  const timesByQuestion = new Map<string, number[]>();
  for (const a of answers) {
    if (a.timeSpentMs > 0) {
      const list = timesByQuestion.get(a.questionId) ?? [];
      list.push(a.timeSpentMs);
      timesByQuestion.set(a.questionId, list);
    }
  }

  const refTimeMsByQuestion = new Map<string, number>();
  for (const [qId, times] of timesByQuestion.entries()) {
    if (times.length >= 3) {
      refTimeMsByQuestion.set(qId, median(times));
    }
  }

  const aggByTopic = new Map<
    TopicCode,
    {
      numerator: number;
      denominator: number;
      weightSum: number;
      answered: number;
      correct: number;
    }
  >();

  for (const topic of ALL_TOPICS) {
    aggByTopic.set(topic, {
      numerator: 0,
      denominator: 0,
      weightSum: 0,
      answered: 0,
      correct: 0,
    });
  }

  const nowMs = now.getTime();

  for (const a of answers) {
    const bucket = aggByTopic.get(a.topic);
    if (!bucket) continue;

    const ageDays = Math.max(0, (nowMs - a.answeredAt.getTime()) / 86_400_000);
    const w = Math.exp(-MASTERY_DECAY_LAMBDA * ageDays);

    const refTimeMs =
      refTimeMsByQuestion.get(a.questionId) ??
      (estimatedTimeByQuestion?.get(a.questionId) !== undefined
        ? estimatedTimeByQuestion.get(a.questionId)! * 1000
        : DEFAULT_REF_TIME_MS);

    let credit = 0;
    if (a.isCorrect) {
      credit =
        a.timeSpentMs > 0 && refTimeMs > 0 && a.timeSpentMs > SLOW_ANSWER_MULTIPLIER * refTimeMs
          ? 0.5
          : 1.0;
    }

    const diffWeight =
      credit > 0
        ? CORRECT_DIFFICULTY_WEIGHT[a.difficulty]
        : WRONG_DIFFICULTY_WEIGHT[a.difficulty];

    bucket.numerator += w * diffWeight * credit;
    bucket.denominator += w * diffWeight;
    bucket.weightSum += w;
    bucket.answered += 1;
    if (a.isCorrect) bucket.correct += 1;
  }

  return ALL_TOPICS.map((topic) => {
    const b = aggByTopic.get(topic)!;
    if (b.answered === 0) {
      return {
        topic,
        mastery: 0.5,
        weakness: 0.5,
        confidence: 0,
        confidenceLabel: 'none',
        answered: 0,
        correct: 0,
        rawAccuracy: null,
        isWeak: false,
        recommendedDifficulty: 'EASY',
      };
    }

    const mastery =
      (b.numerator + MASTERY_PRIOR_ALPHA * MASTERY_PRIOR_P0) /
      (b.denominator + MASTERY_PRIOR_ALPHA);
    const roundedMastery = Number(mastery.toFixed(4));
    const weakness = Number((1 - roundedMastery).toFixed(4));

    return {
      topic,
      mastery: roundedMastery,
      weakness,
      confidence: Number(b.weightSum.toFixed(4)),
      confidenceLabel: classifyConfidence(b.weightSum),
      answered: b.answered,
      correct: b.correct,
      rawAccuracy: Number((b.correct / b.answered).toFixed(4)),
      isWeak: roundedMastery < 0.7,
      recommendedDifficulty: targetDifficultyForMastery(roundedMastery),
    };
  });
}

/**
 * Finds questions whose MOST RECENT attempt was wrong and occurred at least `minAgeDays` ago.
 */
export function computeSpacedReviewCandidates(
  answers: AttemptAnswerRecord[],
  now: Date,
  minAgeDays: number = SPACED_REVIEW_MIN_AGE_DAYS
): SpacedReviewCandidate[] {
  const latestByQuestion = new Map<string, AttemptAnswerRecord>();

  for (const a of answers) {
    const prev = latestByQuestion.get(a.questionId);
    if (!prev || a.answeredAt.getTime() > prev.answeredAt.getTime()) {
      latestByQuestion.set(a.questionId, a);
    }
  }

  const nowMs = now.getTime();
  const eligible: SpacedReviewCandidate[] = [];

  for (const latest of latestByQuestion.values()) {
    if (latest.isCorrect) continue;
    const ageDays = (nowMs - latest.answeredAt.getTime()) / 86_400_000;
    if (ageDays >= minAgeDays) {
      eligible.push({
        questionId: latest.questionId,
        topic: latest.topic,
        difficulty: latest.difficulty,
        lastAnsweredAt: latest.answeredAt,
        ageDays: Number(ageDays.toFixed(2)),
      });
    }
  }

  // Deterministic ordering: oldest wrong question first, then questionId
  eligible.sort((a, b) => {
    if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays;
    return a.questionId.localeCompare(b.questionId);
  });

  return eligible;
}

/**
 * Returns Set of questionIds attempted within the last `excludeRecentDays` days.
 */
export function computeRecentlyAttemptedIds(
  answers: AttemptAnswerRecord[],
  now: Date,
  excludeRecentDays: number
): Set<string> {
  const set = new Set<string>();
  if (excludeRecentDays <= 0) return set;

  const cutoffMs = now.getTime() - excludeRecentDays * 86_400_000;
  for (const a of answers) {
    if (a.answeredAt.getTime() >= cutoffMs) {
      set.add(a.questionId);
    }
  }
  return set;
}
