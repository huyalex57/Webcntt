import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useBookmarks,
  useResourcesPaginated,
} from '../features/resources/api';
import {
  ContributeResourceModal,
  ResourceCard,
  ResourceFilterBar,
} from '../features/resources/components';
import { Button, EmptyState, PageHeader, Pagination, SkeletonCard, Tabs } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';

const PAGE_SIZE = 6;

export default function ResourcesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'saved'>('all');
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [topic, setTopic] = useState(() => searchParams.get('topic') || '');
  const [type, setType] = useState(() => searchParams.get('type') || '');
  const [source, setSource] = useState(() => searchParams.get('source') || '');
  const [page, setPage] = useState(1);
  const [contributeOpen, setContributeOpen] = useState(false);

  useEffect(() => {
    const urlTopic = searchParams.get('topic');
    if (urlTopic !== null && urlTopic !== topic) {
      setTopic(urlTopic);
      setPage(1);
    }
  }, [searchParams]);

  const filter = useMemo(
    () => ({
      q: q || undefined,
      topic: topic || undefined,
      type: type || undefined,
      source: source || undefined,
      mine: activeTab === 'mine' ? true : undefined,
      saved: activeTab === 'saved' ? true : undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [q, topic, type, source, activeTab, page]
  );

  const shouldQuery = activeTab === 'all' || Boolean(user);
  const { data, isLoading } = useResourcesPaginated(filter, shouldQuery);
  const { data: bookmarks = [] } = useBookmarks(Boolean(user));
  const { data: mySummary } = useResourcesPaginated({ mine: true, limit: 1 }, Boolean(user));

  const pageItems = data?.items ?? [];
  const totalCount = data?.meta?.total ?? pageItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleFilterChange = useCallback(
    (updates: { q?: string; topic?: string; type?: string; source?: string }) => {
      if (updates.q !== undefined) setQ(updates.q);
      if (updates.topic !== undefined) {
        setTopic(updates.topic);
        const nextParams = new URLSearchParams(searchParams);
        if (updates.topic) nextParams.set('topic', updates.topic);
        else nextParams.delete('topic');
        setSearchParams(nextParams, { replace: true });
      }
      if (updates.type !== undefined) setType(updates.type);
      if (updates.source !== undefined) setSource(updates.source);
      setPage(1);
    },
    [searchParams, setSearchParams]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kho tài liệu môn học CNTT"
        subtitle="Thư viện giáo trình chính quy, slide bài giảng, đề thi mẫu, bài tập lớn và cheat-sheet — tìm kiếm toàn văn (FTS) & kiểm duyệt bởi giảng viên."
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
          {
            id: 'mine',
            label: 'Tài liệu của tôi',
            count: user ? mySummary?.meta?.total ?? 0 : 0,
          },
          {
            id: 'saved',
            label: 'Đã lưu (Bộ sưu tập)',
            count: user ? bookmarks.length : 0,
          },
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
        totalCount={totalCount}
        onFilterChange={handleFilterChange}
      />

      {!shouldQuery ? (
        <EmptyState
          title="Vui lòng đăng nhập"
          hint="Đăng nhập để xem tài liệu bạn đã đóng góp hoặc bộ sưu tập đã lưu."
        />
      ) : isLoading ? (
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
