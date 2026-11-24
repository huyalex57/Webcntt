import { Request, Response } from 'express';
import { z } from 'zod';
import {
  LevelSchema,
  QuestionDifficultySchema,
  QuestionTypeSchema,
  TopicSchema,
} from '@devstudy/shared';
import { PracticeService } from './practice.service.js';
import { sendError, sendSuccess } from '../../utils/response.js';

const ListQuestionsQuerySchema = z.object({
  topic: TopicSchema.optional(),
  level: LevelSchema.optional(),
  difficulty: QuestionDifficultySchema.optional(),
  type: QuestionTypeSchema.optional(),
  tag: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const ListAttemptsQuerySchema = z.object({
  topic: TopicSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

export class PracticeController {
  static async listQuestions(req: Request, res: Response) {
    const parsed = ListQuestionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        res,
        'Tham số lọc câu hỏi không hợp lệ',
        400,
        'VALIDATION_ERROR',
        parsed.error.format()
      );
    }

    try {
      const questions = await PracticeService.listQuestions(parsed.data);
      return sendSuccess(res, questions, 200, { total: questions.length });
    } catch (err: any) {
      return sendError(res, err.message || 'Lỗi máy chủ', err.status || 500, err.code, err.details);
    }
  }

  static async submitAttempt(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await PracticeService.submitAttempt(userId, req.body);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Lỗi máy chủ', err.status || 500, err.code, err.details);
    }
  }

  static async listAttempts(req: Request, res: Response) {
    const parsed = ListAttemptsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        res,
        'Tham số truy vấn lịch sử không hợp lệ',
        400,
        'VALIDATION_ERROR',
        parsed.error.format()
      );
    }

    try {
      const userId = req.user!.userId;
      const result = await PracticeService.listAttempts(userId, parsed.data);
      return sendSuccess(res, result.items, 200, {
        limit: parsed.data.limit ?? 20,
        hasNext: result.hasNext,
        cursor: result.nextCursor,
      });
    } catch (err: any) {
      return sendError(res, err.message || 'Lỗi máy chủ', err.status || 500, err.code, err.details);
    }
  }

  static async getAttemptById(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const attemptId = req.params.id as string;
      const result = await PracticeService.getAttemptById(userId, attemptId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message || 'Lỗi máy chủ', err.status || 500, err.code, err.details);
    }
  }

  static async getSkillProfiles(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const profiles = await PracticeService.getSkillProfiles(userId);
      return sendSuccess(res, profiles);
    } catch (err: any) {
      return sendError(res, err.message || 'Lỗi máy chủ', err.status || 500, err.code, err.details);
    }
  }
}
