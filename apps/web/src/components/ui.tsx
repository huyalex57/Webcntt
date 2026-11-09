import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const v = variant === 'primary' ? 'bg-primary text-white hover:bg-primary-dark' : variant === 'outline' ? 'border border-border-strong bg-white text-ink hover:bg-surface' : variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-ink hover:bg-surface';
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-lg border border-border bg-white ${className}`}>{children}</div>;
}
export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'navy' }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200', green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200', amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200', navy: 'bg-primary text-white border-primary',
  };
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${map[color]}`}>{children}</span>;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded border border-border-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary ${props.className ?? ''}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded border border-border-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary ${props.className ?? ''}`} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded border border-border-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary ${props.className ?? ''}`} />;
}
export function Label({ children }: { children: ReactNode }) { return <label className="mb-1 block text-sm font-medium text-ink">{children}</label>; }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div><Label>{label}</Label>{children}{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>;
}
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100" aria-label="Đóng">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border-strong bg-white px-6 py-10 text-center"><p className="font-semibold">{title}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export function QuotaBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs font-medium"><span>{label}</span><span>{limit === Infinity ? `${used} câu · không giới hạn` : `${used} / ${limit}`}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-tertiary'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return <div className="flex items-center gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Trước</Button><span className="text-sm">Trang {page} / {totalPages}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Sau →</Button></div>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}</div>{actions && <div className="flex gap-2">{actions}</div>}</div>;
}
export function AuthGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>{fallback ?? <Button onClick={() => setOpen(true)}>Đăng nhập để tiếp tục</Button>}{children}<Modal open={open} onClose={() => setOpen(false)} title="Cần đăng nhập"><p className="text-sm text-slate-600">Hành động này yêu cầu tài khoản miễn phí để hệ thống lưu dữ liệu học tập của bạn.</p><div className="mt-4 flex gap-2"><Link to="/login" className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Đăng nhập</Link><Link to="/register" className="inline-flex items-center justify-center gap-2 rounded border border-border-strong bg-white px-4 py-2 text-sm font-medium hover:bg-surface">Đăng ký miễn phí</Link></div></Modal></>;
}
