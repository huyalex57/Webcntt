import { Router } from 'express';
import { SubmitPracticeAttemptRequestSchema } from '@devstudy/shared';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { validateBody } from '../../middlewares/validate.js';
import { PracticeController } from './practice.controller.js';

export const practiceRouter = Router();

practiceRouter.get('/questions', requireAuth, PracticeController.listQuestions);
practiceRouter.post(
  '/attempts',
  requireAuth,
  validateBody(SubmitPracticeAttemptRequestSchema),
  PracticeController.submitAttempt
);
practiceRouter.get('/attempts', requireAuth, PracticeController.listAttempts);
practiceRouter.get('/attempts/:id', requireAuth, PracticeController.getAttemptById);
practiceRouter.get('/skill-profiles', requireAuth, PracticeController.getSkillProfiles);
