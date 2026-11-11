import type { RunResult } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';

export interface TerminalOutputProps {
  result: RunResult | null;
  isPending: boolean;
}

const STATUS_COLOR: Record<string, 'green' | 'red' | 'amber' | 'slate'> = {
  AC: 'green',
  WA: 'red',
  TLE: 'amber',
  CE: 'slate',
  RE: 'red',
};

export function TerminalOutput({ result, isPending }: TerminalOutputProps) {
  if (isPending) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Đang biên dịch & chạy trên Judge0 sandbox…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Nhấn Ctrl+Enter hoặc bấm "Chạy code" để thực thi
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center gap-3">
        <Badge color={STATUS_COLOR[result.status] ?? 'slate'}>
          {result.status} (exit {result.exitCode})
        </Badge>
        <span className="text-slate-400">Thời gian: {result.timeMs} ms</span>
        <span className="text-slate-400">RAM: {result.memoryMb} MB</span>
      </div>
      {result.stdout && (
        <div>
          <p className="mb-1 text-slate-400">STDOUT:</p>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-emerald-400">
            {result.stdout}
          </pre>
        </div>
      )}
      {result.stderr && (
        <div>
          <p className="mb-1 text-slate-400">STDERR / COMPILER OUTPUT:</p>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-rose-400">
            {result.stderr}
          </pre>
        </div>
      )}
    </div>
  );
}
