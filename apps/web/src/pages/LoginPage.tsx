import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@devstudy/shared';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Button, Card, Field, Input } from '../components/ui';

export default function LoginPage() {
  const { login } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const loc = useLocation() as { state?: { redirect?: string } };
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });
  const onSubmit = async (v: LoginInput) => {
    try { await login(v.email, v.password); toast.push('Đăng nhập thành công'); nav(loc.state?.redirect ?? '/dashboard'); }
    catch { setServerError('Email hoặc mật khẩu không đúng.'); }
  };
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Cổng xác thực chuẩn đào tạo CNTT · v2.4</p>
        <h1 className="mt-1 text-2xl font-bold">Đăng nhập</h1>
        <p className="mt-1 text-sm text-slate-600">Mở khoá 100% giáo trình, Sandbox C++/Java/Python, bài test ACM và AI Review.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <Field label="Email sinh viên hoặc MSSV">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input type="email" placeholder="ban@edu.vn" {...register('email')} />{errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}</Field>
          <Field label="Mật khẩu">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input type="password" placeholder="••••••••" {...register('password')} />{errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}</Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập vào hệ thống DevStudy Hub'}</Button>
        </form>
        <div className="mt-4 space-y-2">
          <Button variant="outline" className="w-full" onClick={() => { void login('huy.nd@edu.vn', 'demo123').then(() => { toast.push('Đã đăng nhập demo: STUDENT Free'); nav('/dashboard'); }); }}>Đăng nhập nhanh demo — STUDENT Free</Button>
          <Button variant="outline" className="w-full" onClick={() => { void login('bao.tq@hust.edu.vn', 'demo123').then(() => { toast.push('Đã đăng nhập demo: LECTURER Premium'); nav('/dashboard'); }); }}>Đăng nhập nhanh demo — LECTURER Premium</Button>
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">Chưa có tài khoản? <Link to="/register" className="font-semibold text-primary">Đăng ký miễn phí</Link></p>
        <p className="mt-2 text-center text-xs text-slate-400">Mock auth: access token chỉ lưu in-memory; refresh mô phỏng. Tài khoản demo xem ở README.</p>
      </Card>
    </div>
  );
}
