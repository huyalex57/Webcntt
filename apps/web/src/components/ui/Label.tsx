import type { LabelHTMLAttributes, ReactNode } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function Label({ children, className = '', ...props }: LabelProps) {
  return (
    <label className={`mb-1 block text-sm font-medium text-ink ${className}`} {...props}>
      {children}
    </label>
  );
}
