import {
  QuestionDifficulty,
  QuestionLevel,
  QuestionStatus,
  QuestionType,
  ResourceTopic,
} from '@prisma/client';
import {
  QUESTION_DIFFICULTY_LABELS,
  type PracticeAnswerGraded,
  type PracticeAttemptSummary,
  type PracticeQuestionItem,
  type SkillProfile,
  type SubmitPracticeAttemptRequest,
  type SubmitPracticeAttemptResponse,
} from '@devstudy/shared';
import { prisma } from '../../config/prisma.js';
import { coreEventBus } from '../../events/bus.js';

export interface ListQuestionsFilter {
  topic?: ResourceTopic;
  level?: QuestionLevel;
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
  tag?: string;
  limit?: number;
}

export interface ListAttemptsFilter {
  topic?: ResourceTopic;
  limit?: number;
  cursor?: string;
}

export class PracticeService {
  /**
   * Lấy danh sách câu hỏi APPROVED từ ngân hàng câu hỏi.
   * Tuyệt đối KHÔNG trả về correctIndex và explanation trước khi nộp bài.
   */
  static async listQuestions(filter: ListQuestionsFilter = {}): Promise<PracticeQuestionItem[]> {
    const take = Math.min(Math.max(filter.limit ?? 20, 1), 50);

    const rows = await prisma.question.findMany({
      where: {
        status: QuestionStatus.APPROVED,
        ...(filter.topic ? { topic: filter.topic } : {}),
        ...(filter.level ? { level: filter.level } : {}),
        ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.tag ? { tags: { has: filter.tag.toLowerCase() } } : {}),
      },
      select: {
        id: true,
        topic: true,
        level: true,
        type: true,
        difficulty: true,
        prompt: true,
        code: true,
        options: true,
        tags: true,
        estimatedTimeSec: true,
      },
      orderBy: [{ topic: 'asc' }, { id: 'asc' }],
      take,
    });

    return rows.map((q) => ({
      id: q.id,
      topic: q.topic,
      level: q.level,
      type: q.type,
      difficulty: q.difficulty,
      difficultyLabel: QUESTION_DIFFICULTY_LABELS[q.difficulty],
      prompt: q.prompt,
      code: q.code,
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      tags: q.tags,
      estimatedTimeSec: q.estimatedTimeSec,
    }));
  }

  /**
   * Nộp bài luyện tập: chấm điểm phía server, lưu practice_attempts + practice_answers,
   * cập nhật skill_profiles trong cùng transaction, và phát event attempt.completed.
   */
  static async submitAttempt(
    userId: string,
    input: SubmitPracticeAttemptRequest
  ): Promise<SubmitPracticeAttemptResponse> {
    const questionIds = input.answers.map((a) => a.questionId);

    const questions = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        status: QuestionStatus.APPROVED,
      },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const invalidIds = questionIds.filter((id) => !questionMap.has(id));
    if (invalidIds.length > 0) {
      throw {
        status: 400,
        code: 'INVALID_QUESTION_IDS',
        message: 'Có câu hỏi không tồn tại hoặc chưa được phê duyệt',
        details: { invalidIds },
      };
    }

    const submittedAt = new Date();
    const gradedRows: Array<{
      question: (typeof questions)[number];
      options: string[];
      selectedIndex: number | null;
      isCorrect: boolean;
      timeSpentMs: number;
    }> = [];

    for (const ans of input.answers) {
      const q = questionMap.get(ans.questionId)!;
      const options = Array.isArray(q.options) ? (q.options as string[]) : [];
      const selectedIndex =
        ans.selectedIndex === undefined || ans.selectedIndex === null ? null : ans.selectedIndex;

      if (selectedIndex !== null && (selectedIndex < 0 || selectedIndex >= options.length)) {
        throw {
          status: 400,
          code: 'INVALID_ANSWER_INDEX',
          message: `Lựa chọn cho câu hỏi ${q.id} vượt ngoài phạm vi đáp án`,
          details: { questionId: q.id, selectedIndex, optionCount: options.length },
        };
      }

      const isCorrect = selectedIndex !== null && selectedIndex === q.correctIndex;
      gradedRows.push({
        question: q,
        options,
        selectedIndex,
        isCorrect,
        timeSpentMs: ans.timeSpentMs ?? 0,
      });
    }

    const totalQuestions = gradedRows.length;
    const correctCount = gradedRows.filter((r) => r.isCorrect).length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const totalAnswerTimeMs = gradedRows.reduce((acc, r) => acc + r.timeSpentMs, 0);
    const durationMs = input.durationMs ?? totalAnswerTimeMs;
    const startedAt = input.startedAt ? new Date(input.startedAt) : null;

    const distinctTopics = [...new Set(gradedRows.map((r) => r.question.topic))];
    const attemptTopic: ResourceTopic | null =
      (input.topic as ResourceTopic | undefined) ??
      (distinctTopics.length === 1 ? distinctTopics[0] : null);

    // Nhóm thống kê theo chủ đề để cập nhật SkillProfile
    const topicStats = new Map<ResourceTopic, { total: number; correct: number }>();
    for (const r of gradedRows) {
      const stat = topicStats.get(r.question.topic) ?? { total: 0, correct: 0 };
      stat.total += 1;
      if (r.isCorrect) stat.correct += 1;
      topicStats.set(r.question.topic, stat);
    }

    const { attempt, updatedSkillProfiles } = await prisma.$transaction(async (tx) => {
      const createdAttempt = await tx.practiceAttempt.create({
        data: {
          userId,
          practiceSetId: input.practiceSetId ?? null,
          topic: attemptTopic,
          totalQuestions,
          correctCount,
          score,
          durationMs,
          startedAt,
          submittedAt,
          answers: {
            create: gradedRows.map((r) => ({
              userId,
              questionId: r.question.id,
              topic: r.question.topic,
              difficulty: r.question.difficulty,
              selectedIndex: r.selectedIndex,
              isCorrect: r.isCorrect,
              timeSpentMs: r.timeSpentMs,
              answeredAt: submittedAt,
            })),
          },
        },
      });

      const updatedProfiles: SkillProfile[] = [];
      for (const [topic, stat] of topicStats.entries()) {
        const existing = await tx.skillProfile.findUnique({
          where: { userId_topic: { userId, topic } },
        });

        const prevAnswered = existing?.answered ?? 0;
        const prevCorrect = existing
          ? Math.round((existing.accuracy * existing.answered) / 100)
          : 0;
        const newAnswered = prevAnswered + stat.total;
        const newCorrect = prevCorrect + stat.correct;
        const newAccuracy = Math.round((newCorrect / newAnswered) * 100);
        const weak = newAccuracy < 70;

        const upserted = await tx.skillProfile.upsert({
          where: { userId_topic: { userId, topic } },
          update: {
            answered: newAnswered,
            accuracy: newAccuracy,
            weak,
          },
          create: {
            userId,
            topic,
            answered: newAnswered,
            accuracy: newAccuracy,
            weak,
          },
        });

        updatedProfiles.push({
          topic: upserted.topic as SkillProfile['topic'],
          accuracy: upserted.accuracy,
          answered: upserted.answered,
          weak: upserted.weak,
        });
      }

      return { attempt: createdAttempt, updatedSkillProfiles: updatedProfiles };
    });

    coreEventBus.emit('attempt.completed', {
      userId,
      attemptId: attempt.id,
      practiceSetId: attempt.practiceSetId,
      topic: attempt.topic,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      score: attempt.score,
      answeredAt: attempt.submittedAt.toISOString(),
    });

    const answersResponse: PracticeAnswerGraded[] = gradedRows.map((r) => ({
      questionId: r.question.id,
      topic: r.question.topic,
      difficulty: r.question.difficulty,
      prompt: r.question.prompt,
      code: r.question.code,
      options: r.options,
      selectedIndex: r.selectedIndex,
      correctIndex: r.question.correctIndex,
      isCorrect: r.isCorrect,
      explanation: r.question.explanation,
      timeSpentMs: r.timeSpentMs,
      answeredAt: submittedAt.toISOString(),
    }));

    return {
      attempt: this.formatAttemptSummary(attempt),
      answers: answersResponse,
      updatedSkillProfiles,
    };
  }

  /**
   * Lịch sử lượt làm bài của chính người dùng hiện tại.
   */
  static async listAttempts(
    userId: string,
    filter: ListAttemptsFilter = {}
  ): Promise<{ items: PracticeAttemptSummary[]; hasNext: boolean; nextCursor?: string }> {
    const take = Math.min(Math.max(filter.limit ?? 20, 1), 50);

    const rows = await prisma.practiceAttempt.findMany({
      where: {
        userId,
        ...(filter.topic ? { topic: filter.topic } : {}),
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });

    const hasNext = rows.length > take;
    const sliced = hasNext ? rows.slice(0, take) : rows;
    const nextCursor = hasNext ? sliced[sliced.length - 1]?.id : undefined;

    return {
      items: sliced.map((a) => this.formatAttemptSummary(a)),
      hasNext,
      nextCursor,
    };
  }

  /**
   * Chi tiết 1 lượt làm bài (chỉ chủ sở hữu mới xem được).
   */
  static async getAttemptById(userId: string, attemptId: string) {
    const attempt = await prisma.practiceAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        answers: {
          orderBy: { id: 'asc' },
          include: { question: true },
        },
      },
    });

    if (!attempt) {
      throw {
        status: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Không tìm thấy lượt làm bài luyện tập',
      };
    }

    const answers: PracticeAnswerGraded[] = attempt.answers.map((a) => ({
      questionId: a.questionId,
      topic: a.topic,
      difficulty: a.difficulty,
      prompt: a.question.prompt,
      code: a.question.code,
      options: Array.isArray(a.question.options) ? (a.question.options as string[]) : [],
      selectedIndex: a.selectedIndex,
      correctIndex: a.question.correctIndex,
      isCorrect: a.isCorrect,
      explanation: a.question.explanation,
      timeSpentMs: a.timeSpentMs,
      answeredAt: a.answeredAt.toISOString(),
    }));

    return {
      attempt: this.formatAttemptSummary(attempt),
      answers,
    };
  }

  /**
   * Lấy SkillProfile của người dùng hiện tại.
   */
  static async getSkillProfiles(userId: string): Promise<SkillProfile[]> {
    const rows = await prisma.skillProfile.findMany({
      where: { userId },
      orderBy: { topic: 'asc' },
    });

    return rows.map((r) => ({
      topic: r.topic as SkillProfile['topic'],
      accuracy: r.accuracy,
      answered: r.answered,
      weak: r.weak,
    }));
  }

  private static formatAttemptSummary(attempt: {
    id: string;
    practiceSetId: string | null;
    topic: ResourceTopic | null;
    totalQuestions: number;
    correctCount: number;
    score: number;
    durationMs: number;
    startedAt: Date | null;
    submittedAt: Date;
  }): PracticeAttemptSummary {
    return {
      id: attempt.id,
      practiceSetId: attempt.practiceSetId,
      topic: attempt.topic,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      score: attempt.score,
      durationMs: attempt.durationMs,
      startedAt: attempt.startedAt ? attempt.startedAt.toISOString() : null,
      submittedAt: attempt.submittedAt.toISOString(),
    };
  }
}
