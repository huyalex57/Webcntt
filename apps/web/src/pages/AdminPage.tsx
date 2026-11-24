import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  REPORT_REASON_LABELS,
  RESOURCE_TYPE_LABELS,
  TOPIC_LABELS,
  type Resource,
} from '@devstudy/shared';
import {
  useAdminReports,
  useAdminResources,
  useAdminStats,
  useApproveResource,
  useRejectResource,
  useResolveReport,
} from '../features/resources/api';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { canModerate, isAdmin } from '../lib/gating';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Textarea,
} from '../components/ui';

export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const session = user ? { role: user.role, plan: user.plan } : null;
  const allowed = canModerate(session);

  const { data: queue = [], isLoading: loadingQueue } = useAdminResources('PENDING', allowed);
  const { data: reports = [], isLoading: loadingReports } = useAdminReports(allowed);
  const { data: stats } = useAdminStats(allowed);

  const approveMutation = useApproveResource();
  const rejectMutation = useRejectResource();
  const resolveReportMutation = useResolveReport();

  const [rejectTarget, setRejectTarget] = useState<Resource | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Quản trị & Kiểm duyệt" />
        <EmptyState
          title="Bạn không có quyền truy cập trang này"
          hint="Chỉ MODERATOR và ADMIN được duyệt tài liệu và xử lý báo cáo. Dùng dropdown “Demo: đổi vai trò” ở header để chuyển sang MODERATOR/ADMIN."
          action={
            <Link to="/">
              <Button>Về trang chủ</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleApprove = async (r: Resource) => {
    try {
      await approveMutation.mutateAsync(r.id);
      toast.push(`Đã duyệt “${r.title}” → PUBLISHED (đã ghi AuditLog)`);
    } catch (err: any) {
      toast.push(err?.message || 'Không thể phê duyệt tài liệu', 'error');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 5) {
      toast.push('Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự)', 'error');
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        id: rejectTarget.id,
        reason: rejectReason.trim(),
      });
      toast.push(`Đã từ chối “${rejectTarget.title}” → REJECTED (đã ghi AuditLog)`);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: any) {
      toast.push(err?.message || 'Không thể từ chối tài liệu', 'error');
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await resolveReportMutation.mutateAsync(reportId);
      toast.push('Đã xử lý & đóng báo cáo vi phạm (đã ghi AuditLog)');
    } catch (err: any) {
      toast.push(err?.message || 'Không thể đóng báo cáo', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản trị & Kiểm duyệt"
        subtitle={
          isAdmin(session)
            ? 'ADMIN: quản trị role, gói, thanh toán, cấu hình và báo cáo hệ thống.'
            : 'MODERATOR: duyệt tài liệu và xử lý báo cáo vi phạm. Không thay đổi role/plan/thanh toán.'
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Chờ duyệt</p>
          <p className="text-2xl font-bold">{stats?.pendingResources ?? queue.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Báo cáo mở</p>
          <p className="text-2xl font-bold">
            {stats?.openReports ?? reports.filter((r) => r.status === 'OPEN').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Người dùng</p>
          <p className="text-2xl font-bold">
            {(stats?.totalUsers ?? 0).toLocaleString('vi-VN')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Lượt chạy code hôm nay</p>
          <p className="text-2xl font-bold">
            {(stats?.todayCodeRuns ?? 0).toLocaleString('vi-VN')}
          </p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Hàng đợi duyệt tài liệu (PENDING)</h3>
        {loadingQueue ? (
          <p className="mt-2 text-sm text-slate-500">Đang tải hàng đợi kiểm duyệt…</p>
        ) : queue.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700">
            Hàng đợi trống — mọi tài liệu đã được xử lý.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {queue.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/resources/${r.id}`} className="font-medium hover:text-primary">
                      {r.title}
                    </Link>
                    <Badge color="blue">{TOPIC_LABELS[r.topic]}</Badge>
                    <Badge>{RESOURCE_TYPE_LABELS[r.type]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {r.author} · {r.fileSize} · {r.tags.join(', ') || 'Không có tag'} · {r.createdAt}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(r)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    Duyệt
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setRejectTarget(r);
                      setRejectReason('');
                    }}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    Từ chối
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Báo cáo vi phạm</h3>
        {loadingReports ? (
          <p className="mt-2 text-sm text-slate-500">Đang tải danh sách báo cáo…</p>
        ) : reports.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa có báo cáo vi phạm nào.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.map((rep) => (
              <li
                key={rep.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <div>
                  <Link
                    to={`/resources/${rep.resourceId}`}
                    className="font-medium hover:text-primary"
                  >
                    {rep.resourceTitle}
                  </Link>
                  <p className="text-sm text-slate-500">
                    Lý do: {REPORT_REASON_LABELS[rep.reason] ?? rep.reason} · Báo bởi{' '}
                    {rep.reporterEmail} · {rep.createdAt}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">{rep.detail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={rep.status === 'OPEN' ? 'amber' : 'green'}>{rep.status}</Badge>
                  {rep.status === 'OPEN' && (
                    <Button
                      variant="outline"
                      onClick={() => handleResolveReport(rep.id)}
                      disabled={resolveReportMutation.isPending}
                    >
                      Đóng báo cáo
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin(session) && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold">Quản trị người dùng &amp; gói (ADMIN)</h3>
          <p className="mt-1 text-sm text-slate-600">
            Đổi role và đổi plan là hai thao tác độc lập. Mọi thao tác nhạy cảm được ghi AuditLog.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Người dùng</th>
                  <th>Role</th>
                  <th>Plan</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { n: 'Nguyễn Đức Huy', r: 'STUDENT', p: 'FREE' },
                  { n: 'TS. Trần Minh Tuấn', r: 'LECTURER', p: 'FREE' },
                  { n: 'Trần Thu Linh', r: 'STUDENT', p: 'PREMIUM' },
                ].map((u) => (
                  <tr key={u.n} className="border-b">
                    <td className="py-2 font-medium">{u.n}</td>
                    <td>{u.r}</td>
                    <td>{u.p}</td>
                    <td>
                      <Button
                        variant="outline"
                        onClick={() =>
                          toast.push(
                            `Đã gửi yêu cầu đổi role cho ${u.n} (cần xác nhận và ghi AuditLog)`
                          )
                        }
                      >
                        Đổi role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reject Reason Modal */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Từ chối tài liệu"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Tài liệu: <strong>{rejectTarget?.title}</strong>
          </p>
          <Field label="Lý do từ chối (gửi cho tác giả & lưu AuditLog) *">
            <Textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="VD: Tài liệu thiếu nguồn trích dẫn bản quyền, chất lượng ảnh mờ hoặc trùng lặp…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={rejectMutation.isPending}
            >
              Huỷ
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Đang xử lý…' : 'Xác nhận từ chối'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
