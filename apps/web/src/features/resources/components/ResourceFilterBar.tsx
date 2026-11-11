import { useEffect, useState } from 'react';
import {
  RESOURCE_TYPE_LABELS,
  TOPIC_LABELS,
  type ResourceType,
  type Topic,
} from '@devstudy/shared';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

export interface ResourceFilterBarProps {
  q: string;
  topic: string;
  type: string;
  source: string;
  totalCount: number;
  onFilterChange: (filters: { q?: string; topic?: string; type?: string; source?: string }) => void;
}

export function ResourceFilterBar({
  q,
  topic,
  type,
  source,
  totalCount,
  onFilterChange,
}: ResourceFilterBarProps) {
  // Local state for debounced search
  const [searchTerm, setSearchTerm] = useState(q);

  useEffect(() => {
    setSearchTerm(q);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== q) {
        onFilterChange({ q: searchTerm });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, q, onFilterChange]);

  const hasActiveFilters = Boolean(q || topic || type || source);

  const clearAllFilters = () => {
    setSearchTerm('');
    onFilterChange({ q: '', topic: '', type: '', source: '' });
  };

  return (
    <Card className="mb-4 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative">
          <Input
            placeholder="Tìm kiếm tài liệu… (tiêu đề, thẻ tag, môn học)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                onFilterChange({ q: '' });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <Select
          value={topic}
          onChange={(e) => onFilterChange({ topic: e.target.value })}
          aria-label="Chọn môn học"
        >
          <option value="">Tất cả môn học</option>
          {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
            <option key={t} value={t}>
              {TOPIC_LABELS[t]}
            </option>
          ))}
        </Select>

        <Select
          value={type}
          onChange={(e) => onFilterChange({ type: e.target.value })}
          aria-label="Chọn loại tài liệu"
        >
          <option value="">Tất cả loại tài liệu</option>
          {(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((t) => (
            <option key={t} value={t}>
              {RESOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>

        <Select
          value={source}
          onChange={(e) => onFilterChange({ source: e.target.value })}
          aria-label="Chọn nguồn tài liệu"
        >
          <option value="">Tất cả nguồn phát hành</option>
          <option value="OFFICIAL">Chính quy khoa CNTT</option>
          <option value="COMMUNITY">Cộng đồng sinh viên</option>
          <option value="LECTURER">Giảng viên chia sẻ</option>
        </Select>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Tìm thấy <strong>{totalCount}</strong> tài liệu phù hợp
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-primary font-medium hover:underline flex items-center gap-1"
          >
            ✕ Xoá tất cả bộ lọc
          </button>
        )}
      </div>
    </Card>
  );
}
