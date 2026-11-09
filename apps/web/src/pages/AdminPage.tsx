import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RESOURCES } from '../lib/seed';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { canModerate, isAdmin } from '../lib/gating';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';

const REPORTS = [
  { id: 'rep1', resource: 'Tài liệu: An toàn thông tin — mã hoá đối xứng & bất đối xứng', reason: 'Vi phạm bản quyền', reporter: 'sv.k22@edu.vn', status: 'OPEN' },
  { id: 'rep2', resource: 'Cheat-sheet Git & Docker cho sinh viên năm 3', reason: 'Nội dung sai lệch', reporter: 'gv.cntt@edu.vn', status: 'OPEN' },
  { id: 'rep3', resource: 'Slide OOP với Java — Chương 1–8', reason: 'File độc hại (nghi ngờ)', reporter: 'mod@devstudy.edu.vn', status: 'RESOLVED' },
];
export default function AdminPage() {
  const { user } = useAuth(); const toast = useToast();
  const session = user ? { role: user.role, plan: user.plan } : null;
  const [queue, setQueue] = useState(RESOURCES.filter((r) => r.status === 'PENDING'));
  const [reports, setReports] = useState(REPORTS);
  if (!canModerate(session)) {
    return <div><PageHeader title="Quản trị & Kiểm duyệt" /><EmptyState title="Bạn không có quyền truy cập trang này" hint="Chỉ MODERATOR và ADMIN được duyệt tài liệu và xử lý báo cáo. Dùng dropdown “Demo: đổi vai trò” ở header để chuyển sang MODERATOR/ADMIN." action={<Link to="/"><Button>Về trang chủ</Button></Link>} /></div>;
  }
  return (
    <div>
      <PageHeader title="Quản trị & Kiểm duyệt" subtitle={isAdmin(session) ? 'ADMIN: quản trị role, gói, thanh toán, cấu hình và báo cáo hệ thống.' : 'MODERATOR: duyệt tài liệu và xử lý báo cáo vi phạm. Không thay đổi role/plan/thanh toán.'} />
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-slate-500">Chờ duyệt</p><p className="text-2xl font-bold">{queue.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Báo cáo mở</p><p className="text-2xl font-bold">{reports.filter((r) => r.status === 'OPEN').length}</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Người dùng</p><p className="text-2xl font-bold">14.820</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Lượt chạy code hôm nay</p><p className="text-2xl font-bold">3.412</p></Card>
      </div>
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Hàng đợi duyệt tài liệu (PENDING)</h3>
        {queue.length === 0 ? <p className="mt-2 text-sm text-emerald-700">Hàng đợi trống — mọi tài liệu đã được xử lý.</p> : (
          <ul className="mt-3 space-y-3">{queue.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
              <div><p className="font-medium">{r.title}</p><p className="text-sm text-slate-500">{r.author} · {r.fileSize} · {r.tags.join(', ')}</p></div>
              <div className="flex gap-2">
                <Button onClick={() => { setQueue((q) => q.filter((x) => x.id !== r.id)); toast.push(`Đã duyệt “${r.title}” → PUBLISHED (ghi AuditLog — mock)`); }}>Duyệt</Button>
                <Button variant="danger" onClick={() => { setQueue((q) => q.filter((x) => x.id !== r.id)); toast.push(`Đã từ chối “${r.title}” → REJECTED, đã gửi lý do cho tác giả (mock)`); }}>Từ chối</Button>
              </div>
            </li>))}
          </ul>
        )}
      </Card>
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Báo cáo vi phạm</h3>
        <ul className="mt-3 space-y-3">{reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
            <div><p className="font-medium">{r.resource}</p><p className="text-sm text-slate-500">Lý do: {r.reason} · Báo bởi {r.reporter}</p></div>
            <div className="flex items-center gap-2"><Badge color={r.status === 'OPEN' ? 'amber' : 'green'}>{r.status}</Badge>
            {r.status === 'OPEN' && <Button variant="outline" onClick={() => { setReports((rs) => rs.map((x) => x.id === r.id ? { ...x, status: 'RESOLVED' } : x)); toast.push('Đã đóng báo cáo — không vi phạm, khôi phục hiển thị (mock)'); }}>Đóng báo cáo</Button>}</div>
          </li>))}
        </ul>
      </Card>
      {isAdmin(session) && (
        <Card className="mt-4 p-5"><h3 className="font-semibold">Quản trị người dùng &amp; gói (ADMIN)</h3>
        <p className="mt-1 text-sm text-slate-600">Đổi role và đổi plan là hai thao tác độc lập. Mọi thao tác nhạy cảm được ghi AuditLog.</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="py-2">Người dùng</th><th>Role</th><th>Plan</th><th>Thao tác</th></tr></thead><tbody>
          {[{ n: 'Nguyễn Đức Huy', r: 'STUDENT', p: 'FREE' }, { n: 'TS. Trần Minh Tuấn', r: 'LECTURER', p: 'FREE' }, { n: 'Trần Thu Linh', r: 'STUDENT', p: 'PREMIUM' }].map((u) => (
            <tr key={u.n} className="border-b"><td className="py-2 font-medium">{u.n}</td><td>{u.r}</td><td>{u.p}</td><td><Button variant="outline" onClick={() => toast.push(`Đã gửi yêu cầu đổi role cho ${u.n} (mock — cần xác nhận và ghi AuditLog)`)}>Đổi role</Button></td></tr>))}
        </tbody></table></div></Card>
      )}
    </div>
  );
}
