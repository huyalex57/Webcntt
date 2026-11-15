import { Request, Response, NextFunction } from 'express';
import { Role } from '@devstudy/shared';
import { sendError } from '../utils/response.js';

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Yêu cầu đăng nhập', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        'Bạn không có quyền thực hiện chức năng này',
        403,
        'FORBIDDEN_ROLE',
        { requiredRoles: allowedRoles, currentRole: req.user.role }
      );
    }

    next();
  };
}
