import argon2 from 'argon2';
import { Role, PlanTier, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../utils/token.js';
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from '@devstudy/shared';

export class AuthService {
  static async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw { status: 409, message: 'Email này đã được sử dụng', code: 'EMAIL_EXISTS' };
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        role: Role.STUDENT,
        emailVerified: true, // Demo MVP tự động verify
        profile: {
          create: {
            studentId: input.studentId,
            university: input.university,
          },
        },
        subscription: {
          create: {
            tier: PlanTier.FREE,
            status: SubscriptionStatus.ACTIVE,
          },
        },
      },
      include: {
        profile: true,
        subscription: true,
      },
    });

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role as any,
      plan: user.subscription?.tier as any || PlanTier.FREE,
    });

    const refreshData = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshData.hash,
        expiresAt: refreshData.expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        plan: user.subscription?.tier || PlanTier.FREE,
        studentId: user.profile?.studentId || undefined,
        university: user.profile?.university || undefined,
        major: user.profile?.major || undefined,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken: refreshData.token,
    };
  }

  static async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        profile: true,
        subscription: true,
      },
    });

    if (!user) {
      throw { status: 401, message: 'Email hoặc mật khẩu không chính xác', code: 'INVALID_CREDENTIALS' };
    }

    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      throw { status: 401, message: 'Email hoặc mật khẩu không chính xác', code: 'INVALID_CREDENTIALS' };
    }

    const plan = user.subscription?.tier || PlanTier.FREE;

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role as any,
      plan: plan as any,
    });

    const refreshData = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshData.hash,
        expiresAt: refreshData.expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        plan,
        studentId: user.profile?.studentId || undefined,
        university: user.profile?.university || undefined,
        major: user.profile?.major || undefined,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken: refreshData.token,
    };
  }

  static async refresh(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw { status: 401, message: 'Thiếu refresh token', code: 'MISSING_REFRESH_TOKEN' };
    }

    const tokenHash = hashToken(rawRefreshToken);
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            profile: true,
            subscription: true,
          },
        },
      },
    });

    if (!existing) {
      throw { status: 401, message: 'Refresh token không hợp lệ', code: 'INVALID_REFRESH_TOKEN' };
    }

    // Kiểm tra nếu token đã bị revoke (Reuse Detection)
    if (existing.revokedAt) {
      // Bảo mật: Nghi ngờ bị đánh cắp token -> Thu hồi toàn bộ token của user!
      await prisma.refreshToken.updateMany({
        where: { userId: existing.userId },
        data: { revokedAt: new Date() },
      });
      throw {
        status: 401,
        message: 'Cảnh báo bảo mật: Token đã bị sử dụng lại. Toàn bộ phiên đăng nhập đã bị huỷ.',
        code: 'TOKEN_REUSE_DETECTED',
      };
    }

    // Kiểm tra hết hạn
    if (existing.expiresAt < new Date()) {
      throw { status: 401, message: 'Refresh token đã hết hạn', code: 'REFRESH_TOKEN_EXPIRED' };
    }

    // Đánh dấu token cũ là revoked
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    // Cấp token mới (Rotation)
    const newRefresh = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: newRefresh.hash,
        expiresAt: newRefresh.expiresAt,
      },
    });

    const user = existing.user;
    const plan = user.subscription?.tier || PlanTier.FREE;

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role as any,
      plan: plan as any,
    });

    return {
      accessToken,
      refreshToken: newRefresh.token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        plan,
        studentId: user.profile?.studentId || undefined,
        university: user.profile?.university || undefined,
        major: user.profile?.major || undefined,
        emailVerified: user.emailVerified,
      },
    };
  }

  static async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  static async forgotPassword(input: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Luôn trả về thành công để tránh timing attack lộ email
    return {
      message: 'Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục mật khẩu đã được gửi.',
    };
  }

  static async resetPassword(userId: string, input: ResetPasswordInput) {
    const passwordHash = await argon2.hash(input.password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Huỷ mọi phiên hiện có
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }

  static async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw { status: 404, message: 'Người dùng không tồn tại', code: 'USER_NOT_FOUND' };
    }

    const isValid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!isValid) {
      throw { status: 400, message: 'Mật khẩu hiện tại không đúng', code: 'INVALID_CURRENT_PASSWORD' };
    }

    const passwordHash = await argon2.hash(input.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscription: true,
      },
    });

    if (!user) {
      throw { status: 404, message: 'Người dùng không tồn tại', code: 'USER_NOT_FOUND' };
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      plan: user.subscription?.tier || PlanTier.FREE,
      studentId: user.profile?.studentId || undefined,
      university: user.profile?.university || undefined,
      major: user.profile?.major || undefined,
      emailVerified: user.emailVerified,
    };
  }

  static async updateProfile(userId: string, input: UpdateProfileInput) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        profile: {
          upsert: {
            create: {
              studentId: input.studentId,
              university: input.university,
              major: input.major,
            },
            update: {
              studentId: input.studentId,
              university: input.university,
              major: input.major,
            },
          },
        },
      },
      include: {
        profile: true,
        subscription: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      plan: updated.subscription?.tier || PlanTier.FREE,
      studentId: updated.profile?.studentId || undefined,
      university: updated.profile?.university || undefined,
      major: updated.profile?.major || undefined,
      emailVerified: updated.emailVerified,
    };
  }
}
