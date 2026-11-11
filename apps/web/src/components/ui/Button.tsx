import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
}

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const v =
    variant === 'primary'
      ? 'bg-primary text-white hover:bg-primary-dark'
      : variant === 'outline'
        ? 'border border-border-strong bg-white text-ink hover:bg-surface'
        : variant === 'danger'
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'text-ink hover:bg-surface';

  return <button className={`${base} ${v} ${className}`} {...props} />;
}
