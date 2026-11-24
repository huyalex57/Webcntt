import type { CodeSnippet } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface SnippetListProps {
  snippets: CodeSnippet[];
  onSelectSnippet: (snippet: CodeSnippet) => void;
  onDeleteSnippet?: (snippet: CodeSnippet) => void;
  onShareSnippet?: (snippet: CodeSnippet) => void;
  deletingId?: string | null;
}

export function SnippetList({
  snippets,
  onSelectSnippet,
  onDeleteSnippet,
  onShareSnippet,
  deletingId,
}: SnippetListProps) {
  if (snippets.length === 0) {
    return <p className="text-xs text-slate-400">Chưa có snippet nào được lưu.</p>;
  }

  return (
    <ul className="space-y-2">
      {snippets.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2.5 text-xs"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-medium text-slate-800">{s.title}</p>
              {s.isPublic && <Badge color="blue">Public</Badge>}
            </div>
            <p className="text-slate-400">
              {s.language} · {s.createdAt} {s.lastRunStatus && `· ${s.lastRunStatus}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {s.lastRunStatus && (
              <Badge
                color={
                  s.lastRunStatus === 'AC'
                    ? 'green'
                    : s.lastRunStatus === 'TLE'
                    ? 'amber'
                    : s.lastRunStatus === 'CE'
                    ? 'slate'
                    : 'red'
                }
              >
                {s.lastRunStatus}
              </Badge>
            )}
            <Button variant="outline" onClick={() => onSelectSnippet(s)} className="px-2 py-1 text-xs">
              Mở
            </Button>
            {onShareSnippet && s.isPublic && (
              <Button
                variant="outline"
                onClick={() => onShareSnippet(s)}
                className="px-2 py-1 text-xs"
                title="Sao chép link chia sẻ"
              >
                Chia sẻ
              </Button>
            )}
            {onDeleteSnippet && (
              <Button
                variant="danger"
                onClick={() => onDeleteSnippet(s)}
                disabled={deletingId === s.id}
                className="px-2 py-1 text-xs"
              >
                Xoá
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
