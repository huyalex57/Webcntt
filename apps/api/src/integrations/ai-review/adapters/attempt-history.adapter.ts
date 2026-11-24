import type { ResourceTopic } from '@prisma/client';
import type {
  AttemptAnswerRecord,
  AttemptHistoryFilter,
  AttemptHistoryPort,
} from '@devstudy/ai-review/contracts';
import { prisma } from '../../../config/prisma.js';

export function createAttemptHistoryAdapter(): AttemptHistoryPort {
  return {
    async listAnswers(
      userId: string,
      filter: AttemptHistoryFilter = {}
    ): Promise<AttemptAnswerRecord[]> {
      const take = Math.min(Math.max(filter.limit ?? 200, 1), 500);

      const rows = await prisma.practiceAnswer.findMany({
        where: {
          userId,
          ...(filter.since ? { answeredAt: { gte: filter.since } } : {}),
          ...(filter.topic ? { topic: filter.topic as ResourceTopic } : {}),
        },
        select: {
          questionId: true,
          topic: true,
          difficulty: true,
          isCorrect: true,
          timeSpentMs: true,
          answeredAt: true,
        },
        orderBy: { answeredAt: 'desc' },
        take,
      });

      return rows.map((r) => ({
        questionId: r.questionId,
        topic: r.topic,
        difficulty: r.difficulty,
        isCorrect: r.isCorrect,
        timeSpentMs: r.timeSpentMs,
        answeredAt: r.answeredAt,
      }));
    },
  };
}
