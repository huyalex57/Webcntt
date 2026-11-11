import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResetPasswordSchema, type ResetPasswordInput } from '@devstudy/shared';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Button, Card, Field, Input } from '../components/ui';

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  const onSubmit = async (v: ResetPasswordInput) => {
    try {
      await resetPassword('mock-token-123', v.password);
      toast.push('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.');
      nav('/login');
    } catch {
      setServerError('Mã xác thực không hợp lệ hoặc đã hết hạn.');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-ink">Đặt lại mật khẩu mới</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vui lòng nhập mật khẩu mới bảo mật tối thiểu 8 ký tự.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <Field label="Mật khẩu mới *">
            <Input
              type="password"
              placeholder="••••••••"
              {...register('password')}
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </Field>

          <Field label="Xác nhận mật khẩu mới *">
            <Input
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              aria-invalid={!!errors.confirmPassword}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
            )}
          </Field>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Đang lưu…' : 'Cập nhật mật khẩu'}
          </Button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Quay lại{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
