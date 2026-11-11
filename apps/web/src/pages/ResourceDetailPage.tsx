import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RESOURCE_TYPE_LABELS, TOPIC_LABELS } from '@devstudy/shared';
import { useResource, useReportResource } from '../features/resources/api';
import { ReportModal } from '../features/resources/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';
import { loadJSON, saveJSON } from '../lib/utils';

export default function ResourceDetailPage() {
  const { id = '' } = useParams();
  const { data: r, isLoading } = useResource(id);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const reportMutation = useReportResource();

  const [reportOpen, setReportOpen] = useState(false);
  const [saved, setSaved] = useState(() => loadJSON<string[]>('collections', []).includes(id));

  useEffect(() => {
    setSaved(loadJSON<string[]>('collections', []).includes(id));
  }, [id]);

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

  const download = () => {
    if (!user) {
      nav('/login', { state: { redirect: `/resources/${id}` } });
      toast.push('Bạn cần đăng nhập để tải tài liệu', 'info');
      return;
    }
    toast.push(`Đã bắt đầu tải “${r.title}” (${r.fileSize}) — mock download`);
  };

  const toggleSave = () => {
    const list = loadJSON<string[]>('collections', []);
    const next = saved ? list.filter((x) => x !== id) : [...list, id];
    saveJSON('collections', next);
    setSaved(!saved);
    toast.push(saved ? 'Đã xoá khỏi bộ sưu tập' : 'Đã lưu vào bộ sưu tập của tôi');
  };

  const handleReportSubmit = async (reason: string, detail: string) => {
    if (detail.trim().length < 10) {
      toast.push('Mô tả vi phạm tối thiểu 10 ký tự', 'error');
      return;
    }
    await reportMutation.mutateAsync({ id, reason, detail });
    toast.push('Đã gửi báo cáo — Moderator sẽ xem xét và xử lý');
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
            <Button onClick={download}>↓ Tải xuống {user ? '' : '(cần đăng nhập)'}</Button>
            <Button variant="outline" onClick={toggleSave}>
              {saved ? '★ Đã lưu vào bộ sưu tập' : '☆ Lưu vào bộ sưu tập'}
            </Button>
            <Button variant="outline" onClick={() => setReportOpen(true)}>
              Báo cáo vi phạm
            </Button>
          </div>
          {!user && (
            <p className="mt-3 text-sm text-amber-700">
              Guest chỉ xem trước 30% tài liệu. Đăng nhập để tải toàn bộ file và lưu bộ sưu tập.
            </p>
          )}
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
