import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'devstudy_refresh_token';

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  });
}

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const result = await AuthService.register(req.body);
      setRefreshTokenCookie(res, result.refreshToken);
      return sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Lỗi đăng ký', err.status || 500, err.code);
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body);
      setRefreshTokenCookie(res, result.refreshToken);
      return sendSuccess(res, { user: result.user, accessToken: result.accessToken });
    } catch (err: any) {
      return sendError(res, err.message || 'Lỗi đăng nhập', err.status || 500, err.code);
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const token = req.cookies[REFRESH_COOKIE_NAME];
      if (!token) {
        return sendError(res, 'Không tìm thấy refresh token trong cookie', 401, 'MISSING_COOKIE');
      }

      const result = await AuthService.refresh(token);
      setRefreshTokenCookie(res, result.refreshToken);
      return sendSuccess(res, { accessToken: result.accessToken, user: result.user });
    } catch (err: any) {
      clearRefreshTokenCookie(res);
      return sendError(res, err.message || 'Lỗi làm mới token', err.status || 401, err.code);
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const token = req.cookies[REFRESH_COOKIE_NAME];
      await AuthService.logout(token);
      clearRefreshTokenCookie(res);
      return sendSuccess(res, { message: 'Đăng xuất thành công' });
    } catch (err: any) {
      clearRefreshTokenCookie(res);
      return sendSuccess(res, { message: 'Đăng xuất thành công' });
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const result = await AuthService.forgotPassword(req.body);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendError(res, 'Không tìm thấy phiên người dùng', 400);
      }
      const result = await AuthService.resetPassword(userId, req.body);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await AuthService.changePassword(userId, req.body);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }

  static async getMe(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const user = await AuthService.getMe(userId);
      return sendSuccess(res, user);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const user = await AuthService.updateProfile(userId, req.body);
      return sendSuccess(res, user);
    } catch (err: any) {
      return sendError(res, err.message, err.status || 500, err.code);
    }
  }
}
