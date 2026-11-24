import { Router } from 'express';
import { CreateSnippetBodySchema, RunCodeBodySchema } from '@devstudy/shared';
import * as codeController from './code.controller.js';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { optionalAuth } from '../../middlewares/optionalAuth.js';
import { rateLimit } from '../../middlewares/rateLimit.js';
import { checkQuota } from '../../middlewares/checkQuota.js';
import { validateBody } from '../../middlewares/validate.js';

export const codeRouter = Router();

codeRouter.get('/languages', codeController.listLanguagesHandler);
codeRouter.get('/quota', requireAuth, codeController.getQuotaHandler);

codeRouter.post(
  '/run',
  requireAuth,
  rateLimit({
    keyPrefix: 'code_run',
    windowSeconds: 60,
    maxRequests: env.CODE_RUN_RATE_LIMIT_PER_MIN,
  }),
  validateBody(RunCodeBodySchema),
  checkQuota('code_run'),
  codeController.runCodeHandler
);

codeRouter.get('/snippets', requireAuth, codeController.listSnippetsHandler);
codeRouter.get('/snippets/:id', optionalAuth, codeController.getSnippetHandler);
codeRouter.post(
  '/snippets',
  requireAuth,
  validateBody(CreateSnippetBodySchema),
  codeController.createSnippetHandler
);
codeRouter.delete('/snippets/:id', requireAuth, codeController.deleteSnippetHandler);
