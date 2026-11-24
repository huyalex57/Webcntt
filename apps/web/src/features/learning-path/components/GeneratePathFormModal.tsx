import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  GenerateLearningPathRequestSchema,
  type GenerateLearningPathRequest,
} from '@devstudy/shared';
import { Modal, Button, Badge } from '../../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { Link } from 'react-router-dom';

interface GeneratePathModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: GenerateLearningPathRequest) => Promise<void>;
  isPending: boolean;
  courseTitle: string;
}

export function GeneratePathFormModal({
  open,
  onClose,
  onSubmit,
  isPending,
  courseTitle,
}: GeneratePathModalProps) {
  const { user } = useAuth();
  const isPremium = user?.plan === 'PREMIUM';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenerateLearningPathRequest>({
    resolver: zodResolver(GenerateLearningPathRequestSchema),
    defaultValues: {
      targetGoal: 'Nắm chắc kiến thức cốt lõi và bài tập thực hành để chuẩn bị thi cuối kỳ đạt điểm cao',
      currentLevel: 'TRUNG_BINH',
      hoursPerWeek: 6,
    },
  });

  const onValidSubmit = async (data: GenerateLearningPathRequest) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo Lộ trình Học tập Cá nhân hoá với AI" maxWidth="lg">
      <div className="space-y-4">
        <div className="rounded-lg bg-blue-50 p-3.5 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Mô hình AI: Gemini 4 Hydrogen Medium
            </span>
            <Badge color="navy">Gói PREMIUM</Badge>
          </div>
          <p className="mt-1 text-xs text-blue-800">
            Khoá học: <strong>{courseTitle}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Hệ thống sẽ phân tích đề cương khoá học kết hợp với điểm mạnh/yếu trong hồ sơ năng lực của bạn để
            tự động thiết kế các chặng học tập (Milestones) thích ứng riêng cho bạn.
          </p>
        </div>

        {!isPremium ? (
          <div className="rounded-lg bg-amber-50 p-4 border border-amber-200 text-center space-y-3">
            <p className="text-sm font-medium text-amber-800">
              Tính năng Lộ trình học tập thích ứng AI dành riêng cho học viên gói <strong>PREMIUM</strong>.
            </p>
            <p className="text-xs text-slate-600">
              Nâng cấp gói để được AI Gemini thiết kế lộ trình riêng, phân tích lỗ hổng kiến thức khi chưa đạt mục tiêu
              và cung cấp bài học bổ trợ phát sinh.
            </p>
            <Link to="/pricing">
              <Button className="mt-2 w-full sm:w-auto">Nâng cấp gói PREMIUM ngay</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mục tiêu học tập của bạn <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('targetGoal')}
                rows={3}
                placeholder="VD: Nắm vững cấu trúc dữ liệu cây và đồ thị để vượt qua vòng phỏng vấn thực tập..."
                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {errors.targetGoal && (
                <p className="mt-1 text-xs text-red-600">{errors.targetGoal.message}</p>
              )}
            </div>

            <div className="grid items-end gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trình độ hiện tại
                </label>
                <select
                  {...register('currentLevel')}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="CO_BAN">Cơ bản (Mới bắt đầu)</option>
                  <option value="TRUNG_BINH">Trung bình — Khá (Đã nắm cơ bản)</option>
                  <option value="NANG_CAO">Nâng cao (Muốn tối ưu chuyên sâu)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời lượng học (giờ / tuần)
                </label>
                <input
                  type="number"
                  {...register('hoursPerWeek', { valueAsNumber: true })}
                  min={2}
                  max={40}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-primary focus:outline-none"
                />
                {errors.hoursPerWeek && (
                  <p className="mt-1 text-xs text-red-600">{errors.hoursPerWeek.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Huỷ
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'AI Gemini đang tạo lộ trình…' : 'Bắt đầu tạo lộ trình'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
