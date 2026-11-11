import { Link } from 'react-router-dom';
import { useResources } from '../features/resources/api';
import { useCourses } from '../features/courses/api';
import { Badge, Button, Card } from '../components/ui';
import { formatVND } from '../lib/utils';
import { useAuth } from '../features/auth/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const { data: resources } = useResources({});
  const { data: courses } = useCourses();
  const top = (resources ?? []).filter((r) => r.status === 'PUBLISHED').sort((a, b) => b.downloads - a.downloads).slice(0, 3);
  return (
    <div>
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <Badge color="blue">Cổng Tài Nguyên Dành Cho GUEST · Kiểm duyệt học thuật ĐHQG &amp; Bách Khoa</Badge>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight">Nền tảng Tự học &amp; Ôn luyện CNTT <span className="text-primary">toàn diện</span> dành cho Sinh viên</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">Hợp nhất hơn 1.200+ đề thi chính quy và giáo trình đại học, lộ trình chuẩn hoá, môi trường Code Sandbox cô lập và AI Mentor cá nhân hoá từng học phần.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? <Link to="/dashboard"><Button>Vào Dashboard của tôi</Button></Link> : <><Link to="/register"><Button>Tạo tài khoản miễn phí</Button></Link><Link to="/resources"><Button variant="outline">Khám phá tài liệu mở</Button></Link></>}
            <Link to="/playground"><Button variant="outline">Chạy C/C++, Java, Python, Go</Button></Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[{ t: 'Kho tài liệu mẫu', d: 'Giáo trình, slide, đề thi được kiểm duyệt bám sát chương trình đại học.' }, { t: 'Môi trường luyện tập', d: 'Sandbox cô lập 256 MB, chạy code trực tuyến và chấm test tự động.' }, { t: 'AI Mentor cá nhân hoá', d: 'Sinh câu hỏi theo chủ đề, trình độ và lịch sử trả lời sai của bạn.' }].map((c) => (
              <Card key={c.t} className="p-5"><h3 className="font-semibold">{c.t}</h3><p className="mt-1 text-sm text-slate-600">{c.d}</p></Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-bold">Phân quyền trải nghiệm học tập</h2><span className="text-sm text-slate-500">Bạn đang truy cập dưới tư cách {user ? `${user.role} · ${user.plan}` : 'Khách vãng lai (GUEST)'}</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5"><h3 className="font-semibold">Quyền hạn GUEST — hiện tại</h3><ul className="mt-2 space-y-1 text-sm text-slate-600"><li>✓ Đọc trước 30% tài liệu học phần</li><li>✓ Duyệt lộ trình Roadmap sơ đồ tĩnh</li><li>✗ Tải file PDF &amp; source code bài giải</li><li>✗ Trình biên dịch Code Sandbox trực tuyến</li></ul></Card>
          <Card className="p-5"><h3 className="font-semibold">Sinh viên (STUDENT FREE) — khuyên dùng</h3><ul className="mt-2 space-y-1 text-sm text-slate-600"><li>✓ Tải tài liệu không giới hạn tốc độ</li><li>✓ Sandbox 256 MB RAM, 4 ngôn ngữ</li><li>✓ AI Quiz &amp; giải thích lỗi runtime (10 lượt/ngày)</li><li>✓ Lưu bookmark lộ trình &amp; lịch sử nộp bài</li></ul>{!user && <Link to="/register" className="mt-3 inline-block text-sm font-semibold text-primary">Đăng ký 30 giây (Miễn phí 100%) →</Link>}</Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10">
        <div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-bold">Kho tài liệu học phần CNTT mẫu</h2><Link to="/resources" className="text-sm font-semibold text-primary">Xem tất cả →</Link></div>
        <div className="grid gap-4 md:grid-cols-3">
          {top.map((r) => (
            <Card key={r.id} className="p-5"><Badge color="amber">HOT</Badge><h3 className="mt-2 font-semibold leading-snug">{r.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</p><p className="mt-3 text-xs text-slate-500">★ {r.rating} ({r.ratingCount}) · {r.downloads.toLocaleString('vi-VN')} lượt tải · {r.fileSize}</p><Link to={`/resources/${r.id}`} className="mt-3 inline-block text-sm font-semibold text-primary">Xem chi tiết →</Link></Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-bold">Khoá học nổi bật</h2><Link to="/courses" className="text-sm font-semibold text-primary">Xem tất cả →</Link></div>
        <div className="grid gap-4 md:grid-cols-3">
          {(courses ?? []).slice(0, 3).map((c) => (
            <Card key={c.id} className="p-5"><Badge color="navy">{c.category}</Badge><h3 className="mt-2 font-semibold leading-snug">{c.title}</h3><p className="mt-1 text-sm text-slate-600">{c.instructor} · ★ {c.rating} ({c.ratingCount})</p><p className="mt-2 text-sm"><span className="font-bold text-primary">{formatVND(c.price)}</span> <span className="text-slate-400 line-through">{formatVND(c.originalPrice)}</span></p><Link to={`/courses/${c.id}`} className="mt-3 inline-block text-sm font-semibold text-primary">Xem đề cương →</Link></Card>
          ))}
        </div>
        <Card className="mt-8 p-6 text-center"><h3 className="text-lg font-bold">Đang có mã phòng thi?</h3><p className="mt-1 text-sm text-slate-600">Nhập mã tham gia để vào kỳ thi được giảng viên mời.</p><Link to="/exams"><Button className="mt-3">Vào thi →</Button></Link></Card>
      </section>
    </div>
  );
}
