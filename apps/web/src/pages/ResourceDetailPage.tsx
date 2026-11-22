import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  RESOURCE_LEVEL_LABELS,
  RESOURCE_TYPE_LABELS,
  TOPIC_LABELS,
  type ReportReason,
} from '@devstudy/shared';
import {
  useDownloadResource,
  useReportResource,
  useResourceDetail,
  useToggleBookmark,
} from '../features/resources/api';
import { ReportModal, ResourceCommentsSection } from '../features/resources/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';

export default function ResourceDetailPage() {
  const { id = '' } = useParams();
  const { data: r, isLoading } = useResourceDetail(id);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const reportMutation = useReportResource();
  const downloadMutation = useDownloadResource();
  const bookmarkMutation = useToggleBookmark(id);

  const [reportOpen, setReportOpen] = useState(false);

  if (isLoading) return <p className="text-sm text-slate-500">Đang tải…</p>;
  if (!r) {
    return (
      <EmptyState
        title="Không tìm thấy tài liệu"
        action={
          <Link to="/resources">
            <Button>Về kho tài liệu</Button>
          </Link>
        }
      />
    );
  }

  const saved = Boolean(r.isBookmarked);

  const download = async () => {
    if (!user) {
      toast.push('Bạn cần đăng nhập để tải tài liệu', 'info');
      nav('/login', { state: { redirect: `/resources/${id}` } });
      return;
    }

    try {
      const res = await downloadMutation.mutateAsync(id);
      const a = document.createElement('a');
      a.href = res.downloadUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (!res.isExternal) {
        a.download = res.fileName;
      }
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.push(`Đã bắt đầu tải “${r.title}” (${r.fileSize})`);
    } catch (err: any) {
      toast.push(err?.message || 'Không thể tải tài liệu lúc này', 'error');
    }
  };

  const toggleSave = async () => {
    if (!user) {
      toast.push('Bạn cần đăng nhập để lưu vào bộ sưu tập', 'info');
      nav('/login', { state: { redirect: `/resources/${id}` } });
      return;
    }
    try {
      const res = await bookmarkMutation.mutateAsync();
      toast.push(
        res.bookmarked ? 'Đã lưu vào bộ sưu tập của tôi' : 'Đã xoá khỏi bộ sưu tập'
      );
    } catch (err: any) {
      toast.push(err?.message || 'Không thể cập nhật bộ sưu tập', 'error');
    }
  };

  const handleOpenReport = () => {
    if (!user) {
      toast.push('Bạn cần đăng nhập để gửi báo cáo vi phạm', 'info');
      nav('/login', { state: { redirect: `/resources/${id}` } });
      return;
    }
    setReportOpen(true);
  };

  const handleReportSubmit = async (reason: ReportReason, detail: string) => {
    if (detail.trim().length < 10) {
      toast.push('Mô tả vi phạm tối thiểu 10 ký tự', 'error');
      throw new Error('Validation failed');
    }
    try {
      await reportMutation.mutateAsync({ id, reason, detail: detail.trim() });
      toast.push('Đã gửi báo cáo — Moderator sẽ xem xét và xử lý');
    } catch (err: any) {
      toast.push(err?.message || 'Không thể gửi báo cáo vi phạm', 'error');
      throw err;
    }
  };

  return (
    <div>
      <PageHeader
        title={r.title}
        subtitle={`${TOPIC_LABELS[r.topic]} · ${RESOURCE_TYPE_LABELS[r.type]} · ${r.author}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Badge color="blue">{TOPIC_LABELS[r.topic]}</Badge>
            <Badge>{RESOURCE_TYPE_LABELS[r.type]}</Badge>
            {r.level && <Badge color="navy">{RESOURCE_LEVEL_LABELS[r.level]}</Badge>}
            <Badge
              color={
                r.status === 'PUBLISHED'
                  ? 'green'
                  : r.status === 'PENDING'
                  ? 'amber'
                  : 'red'
              }
            >
              {r.status}
            </Badge>
          </div>
          {r.status === 'REJECTED' && r.rejectionReason && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <strong>Lý do từ chối:</strong> {r.rejectionReason}
            </div>
          )}
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{r.description}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {r.tags.map((t) => (
              <span key={t} className="rounded bg-surface px-2 py-0.5 text-xs text-slate-600">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Ngôn ngữ: {r.language} · Kích thước: {r.fileSize} · Nguồn:{' '}
            {r.source === 'OFFICIAL'
              ? 'Chính quy khoa CNTT'
              : r.source === 'LECTURER'
              ? 'Giảng viên chia sẻ'
              : 'Cộng đồng sinh viên'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={download} disabled={downloadMutation.isPending}>
              {downloadMutation.isPending
                ? 'Đang tạo link tải…'
                : `↓ Tải xuống ${user ? '' : '(cần đăng nhập)'}`}
            </Button>
            <Button
              variant="outline"
              onClick={toggleSave}
              disabled={bookmarkMutation.isPending}
            >
              {saved ? '★ Đã lưu vào bộ sưu tập' : '☆ Lưu vào bộ sưu tập'}
            </Button>
            <Button variant="outline" onClick={handleOpenReport}>
              Báo cáo vi phạm
            </Button>
          </div>
          {!user && (
            <p className="mt-3 text-sm text-amber-700">
              Guest chỉ xem trước 30% tài liệu. Đăng nhập để tải toàn bộ file qua Presigned URL và lưu bộ sưu tập.
            </p>
          )}

          <div className="mt-6 border-t border-border pt-6">
            <ResourceCommentsSection resourceId={id} />
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold">Thống kê</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Lượt tải</dt>
              <dd className="font-medium">{r.downloads.toLocaleString('vi-VN')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Đánh giá</dt>
              <dd className="font-medium">
                ★ {r.rating} ({r.ratingCount})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Ngày đăng</dt>
              <dd className="font-medium">{r.createdAt}</dd>
            </div>
          </dl>
          <h3 className="mt-5 font-semibold">Tài liệu liên quan</h3>
          <p className="mt-1 text-sm text-slate-500">
            Xem thêm tài liệu cùng môn {TOPIC_LABELS[r.topic]} trong{' '}
            <Link to={`/resources?topic=${r.topic}`} className="font-semibold text-primary">
              kho tài liệu →
            </Link>
          </p>
        </Card>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </div>
  );
}
