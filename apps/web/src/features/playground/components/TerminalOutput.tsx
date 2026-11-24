import type { RunResult } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';

export interface TerminalOutputProps {
  result: RunResult | null;
  isPending: boolean;
}

const STATUS_COLOR: Record<string, 'green' | 'red' | 'amber' | 'slate'> = {
  AC: 'green',
  WA: 'red',
  RE: 'red',
  MLE: 'red',
  TLE: 'amber',
  CE: 'slate',
};

const STATUS_LABEL: Record<string, string> = {
  AC: 'AC · Thành công',
  WA: 'WA · Sai kết quả',
  RE: 'RE · Lỗi thực thi',
  MLE: 'MLE · Quá bộ nhớ',
  TLE: 'TLE · Quá thời gian',
  CE: 'CE · Lỗi biên dịch',
};

export function TerminalOutput({ result, isPending }: TerminalOutputProps) {
  if (isPending) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Đang biên dịch &amp; chạy trên Judge0 sandbox…</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Nhấn Ctrl+Enter hoặc bấm &quot;Chạy Code&quot; để thực thi
      </div>
    );
  }

  const compileOutput = result.compileOutput || result.compile_output || '';
  const memoryKb = result.memoryKb ?? result.memory_kb;
  const memoryDisplay =
    typeof memoryKb === 'number' && memoryKb > 0
      ? memoryKb >= 1024
        ? `${(memoryKb / 1024).toFixed(2)} MB (${memoryKb.toLocaleString('vi-VN')} KB)`
        : `${memoryKb} KB`
      : `${result.memoryMb} MB`;

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <Badge color={STATUS_COLOR[result.status] ?? 'slate'}>
          {STATUS_LABEL[result.status] ?? result.status} (exit {result.exitCode})
        </Badge>
        <span className="text-slate-500">⏱ {result.timeMs} ms</span>
        <span className="text-slate-500">💾 {memoryDisplay}</span>
      </div>

      {compileOutput && (
        <div>
          <p className="mb-1 font-semibold text-amber-700">COMPILER OUTPUT (CE):</p>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-amber-300">
            {compileOutput}
          </pre>
        </div>
      )}

      {result.stdout && (
        <div>
          <p className="mb-1 font-semibold text-slate-500">STDOUT:</p>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-emerald-400">
            {result.stdout}
          </pre>
        </div>
      )}

      {result.stderr && (
        <div>
          <p className="mb-1 font-semibold text-rose-600">STDERR:</p>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-rose-400">
            {result.stderr}
          </pre>
        </div>
      )}

      {!result.stdout && !result.stderr && !compileOutput && (
        <p className="rounded bg-slate-100 p-3 text-slate-500 italic">
          (Chương trình kết thúc nhưng không có dữ liệu xuất ra stdout/stderr)
        </p>
      )}
    </div>
  );
}
