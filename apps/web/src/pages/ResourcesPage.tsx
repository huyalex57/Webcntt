import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RESOURCE_TYPE_LABELS, TOPIC_LABELS, type ResourceType, type Topic } from '@devstudy/shared';
import { useResources } from '../features/resources/hooks';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Pagination, Select } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';

const PAGE_SIZE = 6;
export default function ResourcesPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const filter = useMemo(() => ({ q: q || undefined, topic: topic || undefined, type: type || undefined, source: source || undefined }), [q, topic, type, source]);
  const { data, isLoading } = useResources(filter);
  const list = (data ?? []).filter((r) => r.status === 'PUBLISHED' || user?.role === 'MODERATOR' || user?.role === 'ADMIN');
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div>
      <PageHeader title="Kho tài liệu môn học CNTT" subtitle="Thư viện giáo trình chính quy, slide bài giảng, đề thi mẫu, bài tập lớn và cheat-sheet — kiểm duyệt bởi giảng viên và cộng đồng sinh viên." actions={user?.role === 'LECTURER' ? <Button>Đóng góp tài liệu</Button> : undefined} />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Tìm kiếm tài liệu… (Ctrl + /)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }}><option value="">Tất cả môn</option>{(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}</Select>
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">Tất cả định dạng</option>{(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</option>)}</Select>
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}><option value="">Tất cả nguồn</option><option value="OFFICIAL">Chính quy khoa CNTT</option><option value="COMMUNITY">Cộng đồng sinh viên</option><option value="LECTURER">Giảng viên chia sẻ</option></Select>
        </div>
        <p className="mt-3 text-sm text-slate-500">Bộ sưu tập của tôi: 14 tài liệu đã lưu · {list.length} tài liệu phù hợp</p>
      </Card>
      {isLoading ? <p className="text-sm text-slate-500">Đang tải tài liệu…</p> : pageItems.length === 0 ? <EmptyState title="Không tìm thấy tài liệu phù hợp" hint="Thử đổi từ khoá hoặc bộ lọc khác." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {pageItems.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex gap-2"><Badge color="blue">{TOPIC_LABELS[r.topic]}</Badge><Badge>{RESOURCE_TYPE_LABELS[r.type]}</Badge>{r.status === 'PENDING' && <Badge color="amber">PENDING — chờ duyệt</Badge>}</div>
              <h3 className="mt-2 font-semibold leading-snug"><Link to={`/resources/${r.id}`} className="hover:text-primary">{r.title}</Link></h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-surface px-2 py-0.5 text-xs text-slate-600">{t}</span>)}</div>
              <p className="mt-3 text-xs text-slate-500">★ {r.rating} ({r.ratingCount}) · ↓ {r.downloads.toLocaleString('vi-VN')} · {r.fileSize} · {r.author}</p>
              <div className="mt-3 flex gap-2"><Link to={`/resources/${r.id}`}><Button variant="outline">Xem chi tiết</Button></Link></div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-center"><Pagination page={page} totalPages={totalPages} onPage={setPage} /></div>
    </div>
  );
}
