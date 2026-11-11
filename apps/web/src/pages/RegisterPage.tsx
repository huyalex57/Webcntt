import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterInput } from '@devstudy/shared';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Button, Card, Field, Input, Select } from '../components/ui';

const SCHOOLS = ['ĐH Bách Khoa (Hà Nội / HCM)', 'ĐH Khoa học Tự nhiên', 'Học viện Công nghệ Bưu chính (PTIT)', 'ĐH Công nghệ Thông tin (UIT)', 'Đại học FPT / FUNiX', 'Trường Đại học khác / Tự học'];
export default function RegisterPage() {
  const { register: doRegister } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema), defaultValues: { university: SCHOOLS[0], agree: false } });
  const onSubmit = async (v: RegisterInput) => {
    try { await doRegister(v.displayName, v.email, v.studentId, v.university); toast.push('Tạo tài khoản thành công — role mặc định STUDENT (Free)'); nav('/dashboard'); }
    catch { setServerError('Không tạo được tài khoản, thử lại sau.'); }
  };
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Role mặc định: STUDENT (Gói Free học thuật)</p>
        <h1 className="mt-1 text-2xl font-bold">Đăng ký sinh viên</h1>
        <p className="mt-1 text-sm text-slate-600">Miễn phí 100% trọn đời cho sinh viên các trường ĐH. Giảng viên/quản trị viên được nâng role bởi Admin.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <Field label="Họ và tên sinh viên *">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input placeholder="Nguyễn Đức Huy" {...register('displayName')} />{errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName.message}</p>}</Field>
          <Field label="Email sinh viên / học tập *">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input type="email" placeholder="ban@edu.vn" {...register('email')} />{errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã số sinh viên (MSSV) *">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input placeholder="20220001" {...register('studentId')} />{errors.studentId && <p className="mt-1 text-xs text-red-600">{errors.studentId.message}</p>}</Field>
            <Field label="Trường Đại học / Viện CNTT">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Select {...register('university')}>{SCHOOLS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </div>
          <Field label="Mật khẩu bảo mật *">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input type="password" {...register('password')} />{errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}</Field>
          <Field label="Xác nhận mật khẩu *">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input type="password" {...register('confirmPassword')} />{errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}</Field>
          <label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" {...register('agree')} className="mt-0.5" />Tôi đồng ý với điều khoản học vụ &amp; cam kết tuân thủ quy chuẩn trung thực học thuật của DevStudy Hub.</label>
          {errors.agree && <p className="text-xs text-red-600">{errors.agree.message}</p>}
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản sinh viên (Miễn phí 100%)'}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">Đã có tài khoản? <Link to="/login" className="font-semibold text-primary">Đăng nhập ngay</Link></p>
      </Card>
    </div>
  );
}
