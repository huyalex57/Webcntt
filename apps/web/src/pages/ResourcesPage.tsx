import { useMemo, useState } from 'react';
import { useResources } from '../features/resources/api';
import {
  ContributeResourceModal,
  ResourceCard,
  ResourceFilterBar,
} from '../features/resources/components';
import { Button, EmptyState, PageHeader, Pagination, SkeletonCard, Tabs } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { loadJSON } from '../lib/utils';

const PAGE_SIZE = 6;

export default function ResourcesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'saved'>('all');
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [contributeOpen, setContributeOpen] = useState(false);

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
  const savedIds = useMemo(() => loadJSON<string[]>('collections', []), []);

  const list = useMemo(() => {
    const all = data ?? [];
    if (activeTab === 'mine') {
      return all.filter((r) => r.uploaderId === user?.id || (user && r.author === user.displayName));
    }
    if (activeTab === 'saved') {
      return all.filter((r) => savedIds.includes(r.id));
    }
    // 'all' tab: published, or pending/rejected if moderator/admin
    return all.filter(
      (r) => r.status === 'PUBLISHED' || user?.role === 'MODERATOR' || user?.role === 'ADMIN'
    );
  }, [data, activeTab, user, savedIds]);

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
    <div className="space-y-4">
      <PageHeader
        title="Kho tài liệu môn học CNTT"
        subtitle="Thư viện giáo trình chính quy, slide bài giảng, đề thi mẫu, bài tập lớn và cheat-sheet — kiểm duyệt bởi giảng viên và cộng đồng sinh viên."
        actions={
          user ? (
            <Button onClick={() => setContributeOpen(true)}>
              + Đóng góp tài liệu
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'all', label: 'Tất cả tài liệu' },
          { id: 'mine', label: 'Tài liệu của tôi', count: (data ?? []).filter((r) => r.uploaderId === user?.id || (user && r.author === user.displayName)).length },
          { id: 'saved', label: 'Đã lưu (Bộ sưu tập)', count: savedIds.length },
        ]}
        activeId={activeTab}
        onChange={(id) => {
          setActiveTab(id as typeof activeTab);
          setPage(1);
        }}
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
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'mine'
              ? 'Bạn chưa đóng góp tài liệu nào'
              : activeTab === 'saved'
              ? 'Bộ sưu tập của bạn đang trống'
              : 'Không tìm thấy tài liệu phù hợp'
          }
          hint={
            activeTab === 'mine'
              ? 'Hãy chia sẻ đề thi, giáo trình hoặc slide để hỗ trợ cộng đồng sinh viên CNTT.'
              : activeTab === 'saved'
              ? 'Nhấn "Lưu vào bộ sưu tập" trên các tài liệu bạn muốn xem lại sau.'
              : 'Thử thay đổi từ khoá hoặc xoá các bộ lọc đang chọn.'
          }
          action={
            activeTab === 'mine' && user ? (
              <Button onClick={() => setContributeOpen(true)}>Đóng góp tài liệu ngay</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pageItems.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      )}

      <ContributeResourceModal
        open={contributeOpen}
        onClose={() => setContributeOpen(false)}
      />
    </div>
  );
}
