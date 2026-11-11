import type { CodeSnippet } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface SnippetListProps {
  snippets: CodeSnippet[];
  onSelectSnippet: (snippet: CodeSnippet) => void;
}

export function SnippetList({ snippets, onSelectSnippet }: SnippetListProps) {
  if (snippets.length === 0) {
    return <p className="text-xs text-slate-400">Chưa có snippet nào được lưu.</p>;
  }

  return (
    <ul className="space-y-2">
      {snippets.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between rounded border border-border p-2 text-xs"
        >
          <div>
            <p className="font-medium text-slate-800">{s.title}</p>
            <p className="text-slate-400">
              {s.language} · {s.createdAt} {s.lastRunStatus && `· ${s.lastRunStatus}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {s.lastRunStatus && (
              <Badge color={s.lastRunStatus === 'AC' ? 'green' : 'amber'}>
                {s.lastRunStatus}
              </Badge>
            )}
            <Button variant="outline" onClick={() => onSelectSnippet(s)}>
              Mở
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
