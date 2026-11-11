import type { ReactNode } from 'react';

export type BadgeColor = 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'navy';

export interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
}

export function Badge({ children, color = 'slate' }: BadgeProps) {
  const map: Record<BadgeColor, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    navy: 'bg-primary text-white border-primary',
  };
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${map[color]}`}>
      {children}
    </span>
  );
}
