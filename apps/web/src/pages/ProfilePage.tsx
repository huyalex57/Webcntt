import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChangePasswordSchema,
  UpdateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@devstudy/shared';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Tabs } from '../components/ui';
import { Link } from 'react-router-dom';

const SCHOOLS = [
  'ĐH Bách Khoa (Hà Nội / HCM)',
  'ĐH Khoa học Tự nhiên',
  'Học viện Công nghệ Bưu chính (PTIT)',
  'ĐH Công nghệ Thông tin (UIT)',
  'Đại học FPT / FUNiX',
  'Trường Đại học khác / Tự học',
];

const MAJORS = [
  'Kỹ thuật Phần mềm',
  'Khoa học Máy tính',
  'Hệ thống Thông tin',
  'An toàn Thông tin',
  'Mạng máy tính & Truyền thông',
  'Trí tuệ nhân tạo & Khoa học Dữ liệu',
];

export default function ProfilePage() {
  const { user, updateProfile, changePassword, upgradeToPremium } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'plan'>('profile');

  // Form profile
  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    values: {
      displayName: user?.displayName ?? '',
      studentId: user?.studentId ?? '',
      university: user?.university ?? SCHOOLS[0],
      major: user?.major ?? MAJORS[0],
    },
  });

  // Form password
  const {
    register: regPass,
    handleSubmit: handlePassSubmit,
    reset: resetPassForm,
    formState: { errors: passErrors, isSubmitting: isPassSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  if (!user) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold">Vui lòng đăng nhập để xem hồ sơ</h1>
        <Link to="/login" className="mt-4 inline-block">
          <Button>Đăng nhập ngay</Button>
        </Link>
      </div>
    );
  }

  const onUpdateProfile = async (data: UpdateProfileInput) => {
    try {
      await updateProfile(data);
      toast.push('Cập nhật thông tin hồ sơ thành công!');
    } catch {
      toast.push('Lỗi cập nhật hồ sơ, thử lại sau.', 'error');
    }
  };

  const onChangePassword = async (data: ChangePasswordInput) => {
    try {
      await changePassword(data.currentPassword, data.newPassword);
      toast.push('Đổi mật khẩu thành công!');
      resetPassForm();
    } catch {
      toast.push('Mật khẩu hiện tại không chính xác.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ tài khoản"
        subtitle="Quản lý thông tin cá nhân, vai trò học vụ và thiết lập bảo mật tài khoản"
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* User summary card */}
        <Card className="p-6 h-fit md:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white shadow-md">
              {user.displayName.charAt(0)}
            </div>
            <h2 className="mt-4 text-xl font-bold text-ink">{user.displayName}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Badge color={user.role === 'ADMIN' ? 'red' : user.role === 'LECTURER' ? 'navy' : 'blue'}>
                {user.role}
              </Badge>
              <Badge color={user.plan === 'PREMIUM' ? 'green' : 'slate'}>
                Gói: {user.plan}
              </Badge>
            </div>

            <div className="mt-6 w-full space-y-3 border-t border-border pt-4 text-left text-sm">
              <div>
                <span className="text-xs text-slate-500">Mã số sinh viên / ID:</span>
                <p className="font-medium text-slate-800">{user.studentId || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Trường Đại học:</span>
                <p className="font-medium text-slate-800">{user.university || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Chuyên ngành:</span>
                <p className="font-medium text-slate-800">{user.major || 'Chưa cập nhật'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabbed settings container */}
        <div className="md:col-span-2 space-y-4">
          <Card className="p-0 overflow-hidden">
            <Tabs
              tabs={[
                { id: 'profile', label: 'Thông tin cá nhân' },
                { id: 'security', label: 'Bảo mật & Mật khẩu' },
                { id: 'plan', label: 'Gói dịch vụ & Quota' },
              ]}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as typeof activeTab)}
              className="px-4 pt-2 bg-surface"
            />

            <div className="p-6">
              {activeTab === 'profile' && (
                <form onSubmit={handleProfileSubmit(onUpdateProfile)} className="space-y-4">
                  <h3 className="text-lg font-semibold text-ink">Chỉnh sửa thông tin</h3>

                  <Field label="Họ và tên *">
                    <Input {...regProfile('displayName')} aria-invalid={!!profileErrors.displayName} />
                    {profileErrors.displayName && (
                      <p className="mt-1 text-xs text-red-600">{profileErrors.displayName.message}</p>
                    )}
                  </Field>

                  <Field label="Email đăng ký (không thể thay đổi)">
                    <Input value={user.email} disabled className="bg-slate-100 text-slate-500 cursor-not-allowed" />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Mã số sinh viên (MSSV)">
                      <Input {...regProfile('studentId')} placeholder="20220001" />
                    </Field>

                    <Field label="Chuyên ngành">
                      <Select {...regProfile('major')}>
                        {MAJORS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Field label="Trường Đại học">
                    <Select {...regProfile('university')}>
                      {SCHOOLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <div className="pt-2">
                    <Button type="submit" disabled={isProfileSubmitting}>
                      {isProfileSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'security' && (
                <form onSubmit={handlePassSubmit(onChangePassword)} className="space-y-4">
                  <h3 className="text-lg font-semibold text-ink">Thay đổi mật khẩu</h3>

                  <Field label="Mật khẩu hiện tại *">
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...regPass('currentPassword')}
                      aria-invalid={!!passErrors.currentPassword}
                    />
                    {passErrors.currentPassword && (
                      <p className="mt-1 text-xs text-red-600">{passErrors.currentPassword.message}</p>
                    )}
                  </Field>

                  <Field label="Mật khẩu mới *">
                    <Input
                      type="password"
                      placeholder="•••••••• (tối thiểu 8 ký tự)"
                      {...regPass('newPassword')}
                      aria-invalid={!!passErrors.newPassword}
                    />
                    {passErrors.newPassword && (
                      <p className="mt-1 text-xs text-red-600">{passErrors.newPassword.message}</p>
                    )}
                  </Field>

                  <Field label="Xác nhận mật khẩu mới *">
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...regPass('confirmNewPassword')}
                      aria-invalid={!!passErrors.confirmNewPassword}
                    />
                    {passErrors.confirmNewPassword && (
                      <p className="mt-1 text-xs text-red-600">{passErrors.confirmNewPassword.message}</p>
                    )}
                  </Field>

                  <div className="pt-2">
                    <Button type="submit" disabled={isPassSubmitting}>
                      {isPassSubmitting ? 'Đang xử lý…' : 'Đổi mật khẩu'}
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'plan' && (
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-ink">Trạng thái gói dịch vụ</h3>
                  <div className="rounded-lg border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-primary">
                          Gói hiện tại: {user.plan === 'PREMIUM' ? 'PREMIUM (Chuyên sâu)' : 'FREE (Học thuật)'}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {user.plan === 'PREMIUM'
                            ? 'Mở khóa toàn bộ tính năng AI không giới hạn, Sandbox 200 lượt/ngày, lưu 50 snippets.'
                            : 'Miễn phí học thuật cho sinh viên. Giới hạn 10 câu AI/ngày, Sandbox 30 lượt/ngày.'}
                        </p>
                      </div>
                      {user.plan !== 'PREMIUM' && (
                        <Button
                          onClick={() => {
                            upgradeToPremium();
                            toast.push('Chúc mừng bạn đã nâng cấp gói PREMIUM!');
                          }}
                        >
                          Nâng cấp ngay
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-slate-700">Hạn ngạch sử dụng hôm nay</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded border border-border p-3">
                        <span className="text-xs text-slate-500">Lượt chạy Code Playground</span>
                        <p className="text-base font-bold text-ink">
                          {user.plan === 'PREMIUM' ? '200 lượt / ngày' : '30 lượt / ngày'}
                        </p>
                      </div>
                      <div className="rounded border border-border p-3">
                        <span className="text-xs text-slate-500">Luyện tập AI cá nhân hóa</span>
                        <p className="text-base font-bold text-ink">
                          {user.plan === 'PREMIUM' ? 'Không giới hạn' : '10 câu / ngày'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
