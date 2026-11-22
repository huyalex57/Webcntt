import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.js';

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // Invalid or expired token is treated as Guest for optional routes
    }
  }
  next();
}
