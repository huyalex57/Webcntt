import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/token.js';
import { sendError } from '../utils/response.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Yêu cầu đăng nhập để thực hiện thao tác này', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Phiên đăng nhập đã hết hạn, vui lòng làm mới token', 401, 'TOKEN_EXPIRED');
    }
    return sendError(res, 'Token xác thực không hợp lệ', 401, 'INVALID_TOKEN');
  }
}
