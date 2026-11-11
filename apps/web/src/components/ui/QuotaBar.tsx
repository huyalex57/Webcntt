export interface QuotaBarProps {
  used: number;
  limit: number;
  label: string;
}

export function QuotaBar({ used, limit, label }: QuotaBarProps) {
  const pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span>{limit === Infinity ? `${used} câu · không giới hạn` : `${used} / ${limit}`}</span>
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
