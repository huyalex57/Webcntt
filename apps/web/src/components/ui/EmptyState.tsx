import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  hint?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ title, hint, description, action, children }: EmptyStateProps) {
  const sub = description ?? hint;
  const act = action ?? children;
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-white px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      {act && <div className="mt-4">{act}</div>}
    </div>
  );
}
