import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useEnrollments } from '../features/courses/hooks';
import { useCourses } from '../features/resources/hooks';
import { useExams } from '../features/exams/hooks';
import { Badge, Button, Card, PageHeader, QuotaBar } from '../components/ui';
import { getDailyCount } from '../lib/utils';
import { aiQuotaLimit } from '../lib/gating';

export default function DashboardPage() {
  const { user } = useAuth();
  const session = user ? { role: user.role, plan: user.plan } : null;
  const enrollments = useEnrollments();
  const { data: courses } = useCourses();
  const { data: exams } = useExams();
  const aiUsed = getDailyCount('ai-used');
  const myCourses = (courses ?? []).filter((c) => enrollments.some((e) => e.courseId === c.id));
  return (
    <div>
      <PageHeader title={`Chào ${user?.displayName ?? 'bạn'}, hôm nay bạn muốn Học, Luyện tập hay Chuẩn bị bài thi?`} subtitle={`Học kỳ II · Khoá 2022–2026 · Đồng bộ hệ thống Khoa CNTT · Mục tiêu tuần: hoàn thành 4/5 bài tập CTDL (đã xong 80%)`} actions={<Link to="/playground"><Button>Mở Sandbox</Button></Link>} />
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-slate-500">AI Spaced Repetition</p><p className="mt-1 text-2xl font-bold">142 <span className="text-sm font-normal text-slate-500">câu đã giải</span></p><p className="text-sm">Độ chính xác 86% · Cần ôn: Con trỏ C++, SQL lồng</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Sandbox &amp; Playground</p><p className="mt-1 text-2xl font-bold">28 <span className="text-sm font-normal text-slate-500">snippets</span></p><p className="text-sm">C++ (14) · Python (9) · Java (5)</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Kỳ thi &amp; Kiểm tra</p><p className="mt-1 text-2xl font-bold">{(exams ?? []).length} <span className="text-sm font-normal text-slate-500">kỳ thi</span></p><p className="text-sm">Giữa kỳ CTDL · T6 tới</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Lộ trình Backend Track</p><p className="mt-1 text-2xl font-bold">45%</p><p className="text-sm">18/42 node · Kế tiếp: AVL &amp; Red-Black Tree</p></Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Ôn tập AI hôm nay</h3><Badge color={aiUsed >= 10 && user?.plan === 'FREE' ? 'red' : 'green'}>{user?.plan} · {aiQuotaLimit(session) === Infinity ? 'không giới hạn' : `còn ${Math.max(0, 10 - aiUsed)} lượt`}</Badge></div>
          <div className="mt-3"><QuotaBar used={aiUsed} limit={aiQuotaLimit(session)} label="AI quota hôm nay" /></div>
          <Link to="/practice"><Button className="mt-4">Ôn tập AI →</Button></Link>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold">Lộ trình &amp; nhiệm vụ hôm nay</h3>
          <p className="mt-2 text-sm"><span className="font-medium">Node #19: Đồ thị &amp; Dijkstra</span> — Học phần CTDL &amp; GT (IT202), tiến độ 60%.</p>
          <p className="mt-1 text-sm text-slate-600">Tối ưu hoá hàng đợi ưu tiên (Priority Queue) với mảng dist[] và bảng kề.</p>
          <Link to="/practice" className="mt-3 inline-block text-sm font-semibold text-primary">Tiếp tục luyện tập →</Link>
        </Card>
      </div>
      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Khoá học bạn đang theo học</h3><Link to="/my-courses" className="text-sm font-semibold text-primary">Xem toàn bộ →</Link></div>
        {myCourses.length === 0 ? <p className="mt-3 text-sm text-slate-500">Bạn chưa đăng ký khoá học nào. <Link to="/courses" className="font-semibold text-primary">Khám phá khoá học →</Link></p> : (
          <ul className="mt-3 space-y-3">{myCourses.map((c) => { const e = enrollments.find((x) => x.courseId === c.id)!; return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
              <div><p className="font-medium">{c.title}</p><p className="text-sm text-slate-500">{e.completedLessons}/{e.totalLessons} bài · {e.progress}% hoàn thành</p></div>
              <Link to={`/courses/${c.id}`}><Button variant="outline">Tiếp tục học</Button></Link>
            </li>); })}</ul>
        )}
      </Card>
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">AI Spaced Challenge · C++ Con trỏ — 2 phút</h3>
        <p className="mt-2 font-mono text-sm bg-slate-900 text-slate-100 rounded p-3">int *ptr = new int[50]; delete ptr; // ← chú ý dòng này</p>
        <p className="mt-2 text-sm text-slate-600">Đáp án: B — Rò rỉ bộ nhớ. Phải dùng <code>delete[] ptr</code> khi cấp phát mảng qua <code>new[]</code>.</p>
        <Link to="/practice" className="mt-3 inline-block text-sm font-semibold text-primary">Xem AI giải thích chi tiết →</Link>
      </Card>
    </div>
  );
}
