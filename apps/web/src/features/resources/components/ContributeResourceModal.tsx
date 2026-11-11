import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ContributeResourceSchema,
  RESOURCE_TYPE_LABELS,
  TOPIC_LABELS,
  type ContributeResourceInput,
  type ResourceType,
  type Topic,
} from '@devstudy/shared';
import { useContributeResource } from '../api';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../lib/toast';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';

export interface ContributeResourceModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContributeResourceModal({ open, onClose }: ContributeResourceModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const contributeMutation = useContributeResource();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContributeResourceInput>({
    resolver: zodResolver(ContributeResourceSchema),
    defaultValues: {
      topic: 'CTDL',
      type: 'SLIDE',
      language: 'Tiếng Việt (PDF)',
      fileUrl: '',
      tags: '',
    },
  });

  const onSubmit = async (data: ContributeResourceInput) => {
    try {
      await contributeMutation.mutateAsync({
        ...data,
        author: user?.displayName ?? 'Sinh viên ẩn danh',
        uploaderId: user?.id,
      });
      toast.push(
        'Đã gửi đóng góp tài liệu thành công! Tài liệu đang ở trạng thái PENDING chờ kiểm duyệt viên phê duyệt.'
      );
      reset();
      onClose();
    } catch {
      toast.push('Lỗi gửi tài liệu, vui lòng thử lại sau.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Đóng góp tài liệu học tập CNTT" maxWidth="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-xs text-slate-500">
          Tài liệu bạn chia sẻ sẽ được kiểm duyệt bởi Giảng viên &amp; Kiểm duyệt viên trước khi xuất bản công khai.
        </p>

        <Field label="Tiêu đề tài liệu *">
          <Input
            placeholder="VD: Tổng hợp đề thi cuối kỳ Mạng máy tính 2024 có đáp án"
            {...register('title')}
            aria-invalid={!!errors.title}
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Môn học *">
            <Select {...register('topic')}>
              {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Loại tài liệu *">
            <Select {...register('type')}>
              {(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((t) => (
                <option key={t} value={t}>
                  {RESOURCE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Định dạng / Ngôn ngữ *">
            <Input placeholder="VD: PDF / C++ / Slide PowerPoint" {...register('language')} />
            {errors.language && <p className="mt-1 text-xs text-red-600">{errors.language.message}</p>}
          </Field>

          <Field label="Link tải tài liệu (Google Drive / OneDrive / Dropbox) *">
            <Input placeholder="https://drive.google.com/file/d/..." {...register('fileUrl')} />
            {errors.fileUrl && <p className="mt-1 text-xs text-red-600">{errors.fileUrl.message}</p>}
          </Field>
        </div>

        <Field label="Thẻ tag (phân cách bằng dấu phẩy) *">
          <Input placeholder="VD: Giữa kỳ, K22, Bách Khoa, Bài tập lớn" {...register('tags')} />
          {errors.tags && <p className="mt-1 text-xs text-red-600">{errors.tags.message}</p>}
        </Field>

        <Field label="Mô tả chi tiết nội dung tài liệu *">
          <Textarea
            rows={3}
            placeholder="Mô tả tóm tắt nội dung tài liệu gồm những phần nào, phù hợp cho đối tượng nào…"
            {...register('description')}
          />
          {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang gửi…' : 'Gửi tài liệu phê duyệt'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
