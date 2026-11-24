import { QuestionDifficulty, QuestionStatus, ResourceTopic } from '@prisma/client';
import type {
  PlayableQuestion,
  QuestionCandidate,
  QuestionPoolFilter,
  QuestionPoolPort,
} from '@devstudy/ai-review/contracts';
import { prisma } from '../../../config/prisma.js';

const CANDIDATE_SELECT = {
  id: true,
  topic: true,
  level: true,
  type: true,
  difficulty: true,
  tags: true,
  estimatedTimeSec: true,
} as const;

const PLAYABLE_SELECT = {
  ...CANDIDATE_SELECT,
  prompt: true,
  code: true,
  options: true,
} as const;

export function createQuestionPoolAdapter(): QuestionPoolPort {
  return {
    async findCandidates(filter: QuestionPoolFilter = {}): Promise<QuestionCandidate[]> {
      const take = Math.min(Math.max(filter.limit ?? 100, 1), 500);

      const rows = await prisma.question.findMany({
        where: {
          status: QuestionStatus.APPROVED,
          ...(filter.topics?.length
            ? { topic: { in: filter.topics as ResourceTopic[] } }
            : {}),
          ...(filter.difficulties?.length
            ? { difficulty: { in: filter.difficulties as QuestionDifficulty[] } }
            : {}),
          ...(filter.tags?.length ? { tags: { hasSome: filter.tags } } : {}),
          ...(filter.excludeIds?.length ? { id: { notIn: filter.excludeIds } } : {}),
        },
        select: CANDIDATE_SELECT,
        orderBy: [{ topic: 'asc' }, { id: 'asc' }],
        take,
      });

      return rows;
    },

    async getByIds(ids: string[]): Promise<QuestionCandidate[]> {
      const uniqueIds = [...new Set(ids)].filter(Boolean);
      if (uniqueIds.length === 0) return [];

      return prisma.question.findMany({
        where: {
          id: { in: uniqueIds },
          status: QuestionStatus.APPROVED,
        },
        select: CANDIDATE_SELECT,
      });
    },

    async getPlayableByIds(ids: string[]): Promise<PlayableQuestion[]> {
      const uniqueIds = [...new Set(ids)].filter(Boolean);
      if (uniqueIds.length === 0) return [];

      const rows = await prisma.question.findMany({
        where: {
          id: { in: uniqueIds },
          status: QuestionStatus.APPROVED,
        },
        select: PLAYABLE_SELECT,
      });

      return rows.map((r) => ({
        id: r.id,
        topic: r.topic,
        level: r.level,
        type: r.type,
        difficulty: r.difficulty,
        tags: r.tags,
        estimatedTimeSec: r.estimatedTimeSec,
        prompt: r.prompt,
        code: r.code,
        options: Array.isArray(r.options) ? (r.options as string[]) : [],
      }));
    },
  };
}
