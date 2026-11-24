export interface QuotaBarProps {
  used: number;
  limit: number;
  label: string;
}

export function QuotaBar({ used, limit, label }: QuotaBarProps) {
  const pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100);
  const formattedUsed = used.toLocaleString('vi-VN');
  const formattedLimit = limit === Infinity ? '' : limit.toLocaleString('vi-VN');
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs font-medium">
        <span>{label}</span>
        <span className="shrink-0 whitespace-nowrap">
          {limit === Infinity ? `${formattedUsed} câu · không giới hạn` : `${formattedUsed} / ${formattedLimit}`}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-tertiary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
