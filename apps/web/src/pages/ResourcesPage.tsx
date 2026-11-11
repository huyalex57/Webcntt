import { useMemo, useState } from 'react';
import { useResources } from '../features/resources/api';
import { ResourceCard, ResourceFilterBar } from '../features/resources/components';
import { Button, EmptyState, PageHeader, Pagination } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';

const PAGE_SIZE = 6;

export default function ResourcesPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);

  const filter = useMemo(
    () => ({
      q: q || undefined,
      topic: topic || undefined,
      type: type || undefined,
      source: source || undefined,
    }),
    [q, topic, type, source]
  );

  const { data, isLoading } = useResources(filter);
  const list = (data ?? []).filter(
    (r) => r.status === 'PUBLISHED' || user?.role === 'MODERATOR' || user?.role === 'ADMIN'
  );
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (updates: { q?: string; topic?: string; type?: string; source?: string }) => {
    if (updates.q !== undefined) setQ(updates.q);
    if (updates.topic !== undefined) setTopic(updates.topic);
    if (updates.type !== undefined) setType(updates.type);
    if (updates.source !== undefined) setSource(updates.source);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Kho tài liệu môn học CNTT"
        subtitle="Thư viện giáo trình chính quy, slide bài giảng, đề thi mẫu, bài tập lớn và cheat-sheet — kiểm duyệt bởi giảng viên và cộng đồng sinh viên."
        actions={user?.role === 'LECTURER' ? <Button>Đóng góp tài liệu</Button> : undefined}
      />

      <ResourceFilterBar
        q={q}
        topic={topic}
        type={type}
        source={source}
        totalCount={list.length}
        onFilterChange={handleFilterChange}
      />

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải tài liệu…</p>
      ) : pageItems.length === 0 ? (
        <EmptyState title="Không tìm thấy tài liệu phù hợp" hint="Thử đổi từ khoá hoặc bộ lọc khác." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pageItems.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>
    </div>
  );
}
