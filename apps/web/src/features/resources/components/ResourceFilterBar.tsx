import { RESOURCE_TYPE_LABELS, TOPIC_LABELS, type ResourceType, type Topic } from '@devstudy/shared';
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
  return (
    <Card className="mb-4 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Input
          placeholder="Tìm kiếm tài liệu… (Ctrl + /)"
          value={q}
          onChange={(e) => onFilterChange({ q: e.target.value })}
        />
        <Select
          value={topic}
          onChange={(e) => onFilterChange({ topic: e.target.value })}
        >
          <option value="">Tất cả môn</option>
          {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
            <option key={t} value={t}>
              {TOPIC_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select
          value={type}
          onChange={(e) => onFilterChange({ type: e.target.value })}
        >
          <option value="">Tất cả định dạng</option>
          {(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((t) => (
            <option key={t} value={t}>
              {RESOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select
          value={source}
          onChange={(e) => onFilterChange({ source: e.target.value })}
        >
          <option value="">Tất cả nguồn</option>
          <option value="OFFICIAL">Chính quy khoa CNTT</option>
          <option value="COMMUNITY">Cộng đồng sinh viên</option>
          <option value="LECTURER">Giảng viên chia sẻ</option>
        </Select>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Hiển thị {totalCount} tài liệu phù hợp
      </p>
    </Card>
  );
}
