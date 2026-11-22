import { useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ALLOWED_RESOURCE_EXTENSIONS,
  ALLOWED_RESOURCE_MIME_TYPES,
  ContributeResourceSchema,
  MAX_RESOURCE_FILE_SIZE_BYTES,
  RESOURCE_LEVEL_LABELS,
  RESOURCE_TYPE_LABELS,
  TOPIC_LABELS,
  type ContributeResourceInput,
  type ResourceLevel,
  type ResourceType,
  type Topic,
} from '@devstudy/shared';
import {
  computeFileSha256,
  uploadFileToPresignedUrl,
  useContributeResource,
  usePresignUpload,
} from '../api';
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

const MIME_BY_EXT: Record<string, (typeof ALLOWED_RESOURCE_MIME_TYPES)[number]> = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function resolveMimeType(file: File): (typeof ALLOWED_RESOURCE_MIME_TYPES)[number] | null {
  if (ALLOWED_RESOURCE_MIME_TYPES.includes(file.type as any)) {
    return file.type as (typeof ALLOWED_RESOURCE_MIME_TYPES)[number];
  }
  const lower = file.name.toLowerCase();
  const matchedExt = ALLOWED_RESOURCE_EXTENSIONS.find((ext) => lower.endsWith(ext));
  return matchedExt ? MIME_BY_EXT[matchedExt] : null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ContributeResourceModal({ open, onClose }: ContributeResourceModalProps) {
  const toast = useToast();
  const presignMutation = usePresignUpload();
  const contributeMutation = useContributeResource();

  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);

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
      level: 'INTERMEDIATE',
      language: 'Tiếng Việt (PDF)',
      fileUrl: '',
      tags: '',
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const mime = resolveMimeType(file);
    if (!mime) {
      setSelectedFile(null);
      setFileError('Định dạng không hợp lệ. Chỉ chấp nhận file PDF, DOCX hoặc ZIP.');
      return;
    }

    if (file.size > MAX_RESOURCE_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setFileError('Dung lượng file vượt quá giới hạn tối đa 50MB.');
      return;
    }

    setSelectedFile(file);
  };

  const resetFormState = () => {
    reset();
    setSelectedFile(null);
    setFileError(null);
    setUploadProgress(0);
    setUploadStage(null);
  };

  const onSubmit = async (data: ContributeResourceInput) => {
    setFileError(null);

    if (uploadMode === 'file') {
      if (!selectedFile) {
        setFileError('Vui lòng chọn tệp tài liệu (PDF, DOCX hoặc ZIP) để tải lên.');
        return;
      }
      const contentType = resolveMimeType(selectedFile);
      if (!contentType) {
        setFileError('Định dạng không hợp lệ. Chỉ chấp nhận file PDF, DOCX hoặc ZIP.');
        return;
      }

      try {
        setUploadStage('Đang kiểm tra toàn vẹn file (SHA-256)...');
        const fileHash = await computeFileSha256(selectedFile);

        setUploadStage('Đang xin liên kết tải lên bảo mật (Presigned URL)...');
        setUploadProgress(5);
        const presign = await presignMutation.mutateAsync({
          fileName: selectedFile.name,
          contentType,
          fileSize: selectedFile.size,
        });

        setUploadStage('Đang tải file trực tiếp lên kho lưu trữ S3/MinIO...');
        await uploadFileToPresignedUrl(presign.uploadUrl, selectedFile, (pct) => {
          setUploadProgress(pct);
        });

        setUploadStage('Đang lưu thông tin tài liệu...');
        const ext = selectedFile.name.split('.').pop()?.toUpperCase() || 'PDF';
        await contributeMutation.mutateAsync({
          title: data.title,
          description: data.description,
          topic: data.topic,
          type: data.type,
          level: data.level ?? 'INTERMEDIATE',
          format: ext,
          language: data.language,
          fileKey: presign.fileKey,
          fileSize: selectedFile.size,
          fileHash,
          tags: data.tags,
        });

        toast.push(
          'Tải lên & gửi đóng góp thành công! Tài liệu đang ở trạng thái PENDING chờ Moderator phê duyệt.'
        );
        resetFormState();
        onClose();
      } catch (err: any) {
        const msg = err?.message || 'Lỗi tải tài liệu lên kho lưu trữ, vui lòng thử lại.';
        toast.push(msg, 'error');
        setUploadStage(null);
        setUploadProgress(0);
      }
      return;
    }

    // Link mode
    if (!data.fileUrl || data.fileUrl.trim().length < 5) {
      setFileError('Vui lòng nhập liên kết tài liệu hợp lệ (Google Drive / OneDrive / GitHub...).');
      return;
    }

    try {
      await contributeMutation.mutateAsync({
        title: data.title,
        description: data.description,
        topic: data.topic,
        type: data.type,
        level: data.level ?? 'INTERMEDIATE',
        format: 'LINK',
        language: data.language,
        url: data.fileUrl.trim(),
        tags: data.tags,
      });
      toast.push(
        'Đã gửi đóng góp tài liệu thành công! Tài liệu đang ở trạng thái PENDING chờ Moderator phê duyệt.'
      );
      resetFormState();
      onClose();
    } catch (err: any) {
      toast.push(err?.message || 'Lỗi gửi tài liệu, vui lòng thử lại sau.', 'error');
    }
  };

  const busy = isSubmitting || presignMutation.isPending || contributeMutation.isPending || !!uploadStage;

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Đóng góp tài liệu học tập CNTT" maxWidth="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-xs text-slate-500">
          Tài liệu bạn chia sẻ sẽ được kiểm duyệt bởi Giảng viên &amp; Kiểm duyệt viên trước khi xuất bản công khai.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 rounded-lg border border-border bg-surface p-1 text-xs font-medium">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setUploadMode('file');
              setFileError(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              uploadMode === 'file'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-ink'
            }`}
          >
            Tải file trực tiếp (PDF / DOCX / ZIP ≤ 50MB)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setUploadMode('link');
              setFileError(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              uploadMode === 'link'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-ink'
            }`}
          >
            Chia sẻ liên kết ngoài
          </button>
        </div>

        <Field label="Tiêu đề tài liệu *">
          <Input
            placeholder="VD: Tổng hợp đề thi cuối kỳ Mạng máy tính 2024 có đáp án"
            {...register('title')}
            aria-invalid={!!errors.title}
            disabled={busy}
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Môn học *">
            <Select {...register('topic')} disabled={busy}>
              {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Loại tài liệu *">
            <Select {...register('type')} disabled={busy}>
              {(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((t) => (
                <option key={t} value={t}>
                  {RESOURCE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Mức độ">
            <Select {...register('level')} disabled={busy}>
              {(Object.keys(RESOURCE_LEVEL_LABELS) as ResourceLevel[]).map((lvl) => (
                <option key={lvl} value={lvl}>
                  {RESOURCE_LEVEL_LABELS[lvl]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ngôn ngữ / Định dạng *">
            <Input
              placeholder="VD: Tiếng Việt / C++ / PDF"
              {...register('language')}
              disabled={busy}
            />
            {errors.language && <p className="mt-1 text-xs text-red-600">{errors.language.message}</p>}
          </Field>

          <Field label="Thẻ tag (phân cách bằng dấu phẩy) *">
            <Input
              placeholder="VD: Giữa kỳ, K22, Bách Khoa, Bài tập lớn"
              {...register('tags')}
              disabled={busy}
            />
            {errors.tags && <p className="mt-1 text-xs text-red-600">{errors.tags.message}</p>}
          </Field>
        </div>

        {uploadMode === 'file' ? (
          <Field label="Chọn tệp tài liệu (PDF, DOCX, ZIP — tối đa 50MB) *">
            <div className="rounded-lg border-2 border-dashed border-border-strong bg-surface p-4 text-center">
              <input
                type="file"
                accept=".pdf,.docx,.zip,application/pdf,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                disabled={busy}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary/90"
              />
              {selectedFile && (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Đã chọn: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
              {uploadStage && (
                <div className="mt-3 space-y-1 text-left">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{uploadStage}</span>
                    <span className="font-mono font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
          </Field>
        ) : (
          <Field label="Liên kết tài liệu (Google Drive / OneDrive / GitHub) *">
            <Input
              placeholder="https://drive.google.com/file/d/..."
              {...register('fileUrl')}
              disabled={busy}
            />
            {(errors.fileUrl || fileError) && (
              <p className="mt-1 text-xs text-red-600">{errors.fileUrl?.message || fileError}</p>
            )}
          </Field>
        )}

        <Field label="Mô tả chi tiết nội dung tài liệu *">
          <Textarea
            rows={3}
            placeholder="Mô tả tóm tắt nội dung tài liệu gồm những phần nào, phù hợp cho đối tượng nào…"
            {...register('description')}
            disabled={busy}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Gửi tài liệu phê duyệt'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
