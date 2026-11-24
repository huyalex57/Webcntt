import type { TopicCode } from '../contracts/events.js';
import type { TopicMastery } from './mastery.js';

export interface WeightedItem<K extends string> {
  key: K;
  weight: number;
}

/**
 * Hamilton / Largest-Remainder rounding ensuring exact integer sum === `total`,
 * with deterministic lexicographical tie-breaking on `key`.
 */
export function largestRemainderAllocate<K extends string>(
  items: WeightedItem<K>[],
  total: number
): Map<K, number> {
  const result = new Map<K, number>();
  if (total <= 0 || items.length === 0) return result;

  const normalized = items.map((i) => ({
    key: i.key,
    weight: Math.max(0, i.weight),
  }));

  const weightSum = normalized.reduce((s, i) => s + i.weight, 0);
  const effectiveWeights =
    weightSum > 0
      ? normalized
      : normalized.map((i) => ({ key: i.key, weight: 1 }));
  const denom = effectiveWeights.reduce((s, i) => s + i.weight, 0);

  const quotas = effectiveWeights.map((i) => {
    const exact = (i.weight / denom) * total;
    const floor = Math.floor(exact);
    return {
      key: i.key,
      floor,
      remainder: exact - floor,
    };
  });

  let assigned = 0;
  for (const q of quotas) {
    result.set(q.key, q.floor);
    assigned += q.floor;
  }

  const remaining = total - assigned;
  if (remaining > 0) {
    quotas.sort((a, b) => {
      if (Math.abs(b.remainder - a.remainder) > 1e-12) {
        return b.remainder - a.remainder;
      }
      return a.key.localeCompare(b.key);
    });

    for (let i = 0; i < remaining; i++) {
      const k = quotas[i % quotas.length].key;
      result.set(k, (result.get(k) ?? 0) + 1);
    }
  }

  return result;
}

export interface SlotAllocationPlan {
  spacedReviewSlots: number;
  weakTopicSlots: Map<TopicCode, number>;
  explorationSlots: Map<TopicCode, number>;
}

export function allocateQuestionSlots(params: {
  requested: number;
  masteries: TopicMastery[];
  explicitTopics?: TopicCode[];
  spacedReviewAvailable: number;
}): SlotAllocationPlan {
  const { requested, masteries, explicitTopics, spacedReviewAvailable } = params;

  const targetSpaced = Math.min(Math.round(requested * 0.25), Math.max(0, spacedReviewAvailable));
  const masteryByTopic = new Map(masteries.map((m) => [m.topic, m]));

  // When user explicitly selected topics, focus 100% of remaining slots on those topics weighted by weakness
  if (explicitTopics && explicitTopics.length > 0) {
    const uniqueTopics = [...new Set(explicitTopics)];
    const remaining = Math.max(0, requested - targetSpaced);
    const weighted = uniqueTopics.map((t) => ({
      key: t,
      weight: masteryByTopic.get(t)?.weakness ?? 0.5,
    }));

    return {
      spacedReviewSlots: targetSpaced,
      weakTopicSlots: largestRemainderAllocate(weighted, remaining),
      explorationSlots: new Map(),
    };
  }

  // Adaptive mode: 60% weak topics (top k <= 4), 25% spaced review, 15% exploration
  const untouchedOrLow = masteries
    .filter((m) => m.answered === 0 || m.confidenceLabel === 'low')
    .sort((a, b) => {
      if (a.answered !== b.answered) return a.answered - b.answered;
      return a.topic.localeCompare(b.topic);
    });

  const targetExploration =
    untouchedOrLow.length > 0 ? Math.min(Math.round(requested * 0.15), requested - targetSpaced) : 0;

  const targetWeak = Math.max(0, requested - targetSpaced - targetExploration);

  // Pick top k <= 4 weakest topics (preferring topics with history first, falling back to all topics)
  const practicedSorted = masteries
    .filter((m) => m.answered > 0)
    .sort((a, b) => {
      if (b.weakness !== a.weakness) return b.weakness - a.weakness;
      return a.topic.localeCompare(b.topic);
    });

  const weakPool = (practicedSorted.length > 0 ? practicedSorted : masteries)
    .slice(0, 4)
    .map((m) => ({ key: m.topic, weight: Math.max(0.05, m.weakness) }));

  const explorationTopics = untouchedOrLow
    .slice(0, 4)
    .map((m) => ({ key: m.topic, weight: 1 }));

  return {
    spacedReviewSlots: targetSpaced,
    weakTopicSlots: largestRemainderAllocate(weakPool, targetWeak),
    explorationSlots:
      targetExploration > 0
        ? largestRemainderAllocate(explorationTopics, targetExploration)
        : new Map(),
  };
}
