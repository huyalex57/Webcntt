import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type {
  AuthPort,
  AuthenticatedStudentRequest,
} from '@devstudy/ai-review/contracts';
import { requireAuth } from '../../../middlewares/requireAuth.js';
import { requireRole } from '../../../middlewares/requireRole.js';

export function createAuthAdapter(): AuthPort {
  const onlyStudent = requireRole('STUDENT');

  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (authErr?: unknown) => {
      if (authErr) return next(authErr);
      onlyStudent(req, res, (roleErr?: unknown) => {
        if (roleErr) return next(roleErr);
        if (!req.user) {
          return next(new Error('Authenticated user missing after requireAuth'));
        }
        (req as AuthenticatedStudentRequest).aiReviewStudent = {
          userId: req.user.userId,
          role: 'STUDENT',
        };
        return next();
      });
    });
  };

  return {
    requireStudent: () => middleware,
  };
}
