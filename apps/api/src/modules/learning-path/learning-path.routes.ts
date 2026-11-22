import { Router } from 'express';
import { PlanTier } from '@prisma/client';
import { LearningPathController } from './learning-path.controller.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requirePlan } from '../../middlewares/requirePlan.js';
import { validateBody } from '../../middlewares/validate.js';
import {
  GenerateLearningPathRequestSchema,
  EvaluateMilestoneRequestSchema,
} from '@devstudy/shared';

export const learningPathRouter = Router();

// 1. Tạo lộ trình khoá học cá nhân hoá (yêu cầu PREMIUM)
learningPathRouter.post(
  '/courses/:id/generate-path',
  requireAuth,
  requirePlan(PlanTier.PREMIUM),
  validateBody(GenerateLearningPathRequestSchema),
  LearningPathController.generatePath
);

// 2. Lấy lộ trình hiện tại của sinh viên
learningPathRouter.get(
  '/courses/:id/learning-path',
  requireAuth,
  LearningPathController.getPath
);

// 3. Đánh giá kết quả bài kiểm tra của một Milestone (yêu cầu PREMIUM)
learningPathRouter.post(
  '/milestones/:id/evaluate',
  requireAuth,
  requirePlan(PlanTier.PREMIUM),
  validateBody(EvaluateMilestoneRequestSchema),
  LearningPathController.evaluateMilestone
);

// 4. Đánh dấu hoàn thành bài ôn tập bổ trợ
learningPathRouter.post(
  '/remediations/:id/complete',
  requireAuth,
  LearningPathController.completeRemediation
);
