import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@devstudy/shared';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Button, Card, Field, Input } from '../components/ui';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const toast = useToast();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const onSubmit = async (v: ForgotPasswordInput) => {
    try {
      await forgotPassword(v.email);
      setSubmittedEmail(v.email);
      toast.push('Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư.');
    } catch {
      toast.push('Không thể gửi yêu cầu đặt lại mật khẩu, thử lại sau.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-ink">Quên mật khẩu?</h1>
        <p className="mt-1 text-sm text-slate-600">
          Nhập địa chỉ email trường hoặc cá nhân đã đăng ký để nhận liên kết đặt lại mật khẩu.
        </p>

        {submittedEmail ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">✓ Đã gửi hướng dẫn!</p>
            <p className="mt-1">
              Liên kết đặt lại mật khẩu đã được gửi tới <strong>{submittedEmail}</strong>.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/reset-password">
                <Button className="w-full">Đi tới trang Đặt lại mật khẩu</Button>
              </Link>
              <Link to="/login" className="text-center text-xs text-primary font-medium hover:underline">
                Quay lại Đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
            <Field label="Email đăng ký *">
              <Input
                type="email"
                placeholder="sinhvien@edu.vn"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </Field>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Đang gửi…' : 'Gửi liên kết đặt lại mật khẩu'}
            </Button>

            <p className="mt-4 text-center text-sm text-slate-500">
              Nhớ lại mật khẩu?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Đăng nhập
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
