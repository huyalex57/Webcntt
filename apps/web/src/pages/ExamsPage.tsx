import { Link } from 'react-router-dom';
import { useExams } from '../features/exams/hooks';
import { useAuth } from '../features/auth/AuthContext';
import { canCreateExam, examCreateBlockReason } from '../lib/gating';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';
import { formatDateTime } from '../lib/utils';

export default function ExamsPage() {
  const { data, isLoading } = useExams();
  const { user } = useAuth();
  const session = user ? { role: user.role, plan: user.plan } : null;
  const block = examCreateBlockReason(session);
  return (
    <div>
      <PageHeader title="Thi lập trình online" subtitle="Kỳ thi do giảng viên tạo, chấm tự động bằng test case ẩn/hiện. Server là nguồn thời gian chuẩn; hết giờ tự động nộp bài." actions={
        canCreateExam(session) ? <Link to="/exams/new"><Button>+ Tạo kỳ thi mới</Button></Link> : <Link to="/exams/new"><Button variant="outline">Tạo kỳ thi (LECTURER Premium)</Button></Link>
      } />
      {block && user && <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{block} <Link to="/pricing" className="font-semibold underline">Xem gói Premium →</Link></Card>}
      {!user && <Card className="mb-4 p-4 text-sm text-slate-600">Bạn đang xem với tư cách Guest. Đăng nhập để tham gia kỳ thi khi được mời (theo lớp / mã tham gia / email).</Card>}
      {isLoading ? <p className="text-sm text-slate-500">Đang tải kỳ thi…</p> : (data ?? []).length === 0 ? <EmptyState title="Chưa có kỳ thi nào" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((e) => (
            <Card key={e.id} className="p-5">
              <div className="flex gap-2"><Badge color={e.status === 'PUBLISHED' ? 'green' : e.status === 'DRAFT' ? 'amber' : 'slate'}>{e.status}</Badge><Badge>{e.durationMin} phút</Badge><Badge>{e.problems.length} bài</Badge></div>
              <h3 className="mt-2 font-semibold leading-snug">{e.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{e.description}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(e.startsAt)} → {formatDateTime(e.endsAt)} · {e.participants} thí sinh · Ngôn ngữ: {e.languages.join(', ').toUpperCase()} · Tạo bởi {e.creator}</p>
              <div className="mt-3"><Link to={`/exams/${e.id}`}><Button>{e.status === 'DRAFT' ? 'Xem bản nháp' : 'Vào thi →'}</Button></Link></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
