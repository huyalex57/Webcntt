import { Link } from 'react-router-dom';
import { useCourses, useEnrollments } from '../features/courses/api';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';

export default function MyCoursesPage() {
  const enrollments = useEnrollments();
  const { data: courses } = useCourses();
  const mine = (courses ?? []).filter((c) => enrollments.some((e) => e.courseId === c.id));
  return (
    <div>
      <PageHeader title="Khoá học của tôi" subtitle={`${mine.length} khoá đang theo học · Chứng nhận được cấp khi hoàn thành 100%`} />
      {mine.length === 0 ? <EmptyState title="Bạn chưa có khoá học nào" hint="Khám phá khoá học và đăng ký để bắt đầu." action={<Link to="/courses"><Button>Khám phá khoá học</Button></Link>} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {mine.map((c) => {
            const e = enrollments.find((x) => x.courseId === c.id)!;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex gap-2"><Badge color="navy">{c.category}</Badge>{e.certificateIssued && <Badge color="green">Đã cấp chứng nhận</Badge>}</div>
                <h3 className="mt-2 font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{c.instructor} · Đang học: Bài {e.completedLessons + 1} · Còn lại ~{Math.max(0, c.hours - Math.round(c.hours * e.progress / 100))} giờ</p>
                <div className="mt-3"><div className="flex justify-between text-xs font-medium"><span>Tiến độ</span><span>{e.progress}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-tertiary" style={{ width: `${e.progress}%` }} /></div></div>
                <p className="mt-2 text-sm text-slate-500">{e.completedLessons}/{e.totalLessons} bài giảng &amp; Sandbox</p>
                <div className="mt-3 flex gap-2"><Link to={`/courses/${c.id}`}><Button>Tiếp tục học ngay</Button></Link>{e.certificateIssued && <Button variant="outline" onClick={() => alert(`Chứng nhận: ${c.title}\nHọc viên: bạn\nCấp bởi DevStudy Hub — 2026`)}>Xem chứng nhận</Button>}</div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">Nút “Đánh dấu hoàn thành” nằm trong trang chi tiết từng khoá học (đánh dấu xong sẽ cập nhật tiến độ tại đây).</p>
    </div>
  );
}
