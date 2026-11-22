import { Request, Response } from 'express';
import { LearningPathService } from './learning-path.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export class LearningPathController {
  static async generatePath(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const courseId = req.params.id as string;
      const result = await LearningPathService.generatePath(userId, courseId, req.body);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }

  static async getPath(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const courseId = req.params.id as string;
      const result = await LearningPathService.getPath(userId, courseId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }

  static async evaluateMilestone(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const milestoneId = req.params.id as string;
      const result = await LearningPathService.evaluateMilestone(userId, milestoneId, req.body);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }

  static async completeRemediation(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const remediationId = req.params.id as string;
      const result = await LearningPathService.completeRemediation(userId, remediationId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }
}
