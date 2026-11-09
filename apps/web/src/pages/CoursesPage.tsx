import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourses } from '../features/resources/hooks';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '../components/ui';
import { formatVND } from '../lib/utils';

const CATS = ['Tất cả', 'Backend & Microservices', 'Frontend & Fullstack', 'Data Science & AI', 'DevOps & Cloud', 'Thuật toán & ICPC'];
export default function CoursesPage() {
  const [q, setQ] = useState(''); const [cat, setCat] = useState('Tất cả'); const [sort, setSort] = useState('rating');
  const { data, isLoading } = useCourses(q);
  let list = (data ?? []).filter((c) => cat === 'Tất cả' || c.category === cat);
  if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
  if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
  if (sort === 'students') list = [...list].sort((a, b) => b.students - a.students);
  return (
    <div>
      <PageHeader title="Khoá học & chuyên đề CNTT chuyên sâu" subtitle="Các khoá học thực chiến từ giảng viên Đại học & kỹ sư doanh nghiệp, tích hợp bài tập tương tác trên Code Sandbox và kiểm tra AI cá nhân hoá." />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">{CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded border px-3 py-1.5 text-sm font-medium ${cat === c ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white hover:bg-surface'}`}>{c}</button>)}</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input placeholder="Tìm khoá học…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={sort} onChange={(e) => setSort(e.target.value)}><option value="rating">Được đánh giá cao nhất</option><option value="students">Học nhiều nhất</option><option value="price-asc">Giá: Thấp đến Cao</option></Select>
          <p className="self-center text-sm text-slate-500">{list.length} khoá học · 14 khoá mới mở đăng ký</p>
        </div>
      </Card>
      <Card className="mb-4 border-primary bg-white p-5">
        <Badge color="navy">Chuyên đề tiêu điểm tuần</Badge>
        <h3 className="mt-2 text-lg font-bold">Thiết kế kiến trúc Microservices &amp; Distributed Systems với Golang + Docker/K8s</h3>
        <p className="mt-1 text-sm text-slate-600">TS. Trịnh Quốc Bảo &amp; KTS. Lê Hoàng Việt · ★ 4.9 (1,248 đánh giá) · 42 giờ video · 68 bài học · 35 Sandbox lab · Chứng nhận chuẩn Kỹ sư Quốc tế.</p>
        <Link to="/courses/c3"><Button className="mt-3">Xem khoá học</Button></Link>
      </Card>
      {isLoading ? <p className="text-sm text-slate-500">Đang tải khoá học…</p> : list.length === 0 ? <EmptyState title="Không tìm thấy khoá học" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex gap-2"><Badge color="navy">{c.category}</Badge><Badge>{c.level}</Badge></div>
              <h3 className="mt-2 font-semibold leading-snug">{c.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{c.instructor} · {c.instructorRole}</p>
              <p className="mt-1 text-sm text-slate-500">★ {c.rating} ({c.ratingCount.toLocaleString('vi-VN')}) · {c.hours} giờ video · {c.lessonsCount} bài · {c.labs} lab</p>
              <div className="mt-2 flex flex-wrap gap-1">{c.tags.map((t) => <span key={t} className="rounded bg-surface px-2 py-0.5 text-xs text-slate-600">{t}</span>)}</div>
              <div className="mt-auto pt-3"><p><span className="text-lg font-bold text-primary">{formatVND(c.price)}</span> <span className="text-sm text-slate-400 line-through">{formatVND(c.originalPrice)}</span></p>
              <div className="mt-2 flex gap-2"><Link to={`/courses/${c.id}`}><Button variant="outline">Xem đề cương</Button></Link><Link to={`/courses/${c.id}`}><Button>Đăng ký học</Button></Link></div></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
