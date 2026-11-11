import { z } from 'zod';

export const RoleSchema = z.enum(['STUDENT', 'LECTURER', 'MODERATOR', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const PlanTierSchema = z.enum(['FREE', 'PREMIUM']);
export type PlanTier = z.infer<typeof PlanTierSchema>;

/** GUEST không phải role DB — chỉ là trạng thái chưa đăng nhập. */
export type GuestOrRole = 'GUEST' | Role;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: RoleSchema,
  plan: PlanTierSchema,
  studentId: z.string().optional(),
  university: z.string().optional(),
  major: z.string().optional(),
  emailVerified: z.boolean().default(true),
});
export type User = z.infer<typeof UserSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  displayName: z.string().min(2, 'Nhập họ tên đầy đủ'),
  email: z.string().email('Email không hợp lệ'),
  studentId: z.string().min(4, 'Nhập mã số sinh viên'),
  university: z.string().min(2, 'Chọn trường'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  confirmPassword: z.string(),
  agree: z.boolean().refine((v) => v, 'Bạn cần đồng ý điều khoản học vụ'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Vui lòng nhập địa chỉ email hợp lệ'),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2, 'Họ và tên tối thiểu 2 ký tự'),
  studentId: z.string().optional(),
  university: z.string().optional(),
  major: z.string().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
  confirmNewPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmNewPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmNewPassword'],
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
